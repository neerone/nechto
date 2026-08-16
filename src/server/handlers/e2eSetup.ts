import {GameServer} from 'server/server/GameServer';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import type {IGameSocket} from 'shared/interfaces/socket';
import {fullDeckObject, instantiateCard} from 'shared/constant/cards';
import {avatarsCount} from 'shared/constant/avatars';
import {ICardAny, ICardEvent} from 'shared/interfaces/cards';
import {ECardType} from 'shared/enum/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {getCardActions} from 'server/formatters/formatCardActions';
import {each, filter, find, uniqueId} from 'lodash';

// E2E-ONLY deterministic setup hook.
//
// The real game shuffles the deck and deals random hands, so a browser session
// cannot, on its own, reproduce a specific card scenario. This handler — gated
// behind NECHTO_E2E=true and therefore inert in production — rearranges an
// already-started game into an exact, known state (player order, hands, deck,
// quarantines, doors, the Thing) and rebroadcasts it. The Playwright per-card
// specs call it, then drive the real client/server/socket end to end.
//
// It deliberately flips gameServer.ignoreChecks on, because hand-crafted hands
// will not match the dealt `initialDeck` that checkAllDeckCards validates.

interface IE2ESetupPayload {
	// playersList order, by nickname (left-to-right seating).
	players?: unknown;
	// Whose turn it is (nickname). Defaults to players[0].
	turn?: unknown;
	// Turn phase the turn player lands in: 'inCardAction' (already drew, default)
	// or 'inCardPick' (must still draw from the deck).
	turnState?: unknown;
	// Per-player hands, keyed by nickname -> array of card ids.
	hands?: unknown;
	// Deck contents, top card first (card ids; may include panics).
	deck?: unknown;
	// Discard pile contents (card ids).
	discarded?: unknown;
	// Nicknames that are the Thing (also marked infected).
	things?: unknown;
	// Nicknames that are infected (but not the Thing).
	infected?: unknown;
	// Doors to insert into the seating: each {after: nick} places a barricaded
	// "Дверь" right after that player in playersList.
	doors?: unknown;
	// Per-player quarantine counter, keyed by nickname -> remaining turns.
	quarantine?: unknown;
	// Nicknames whose quarantine was "just applied" (skips the first tick).
	quarantineFresh?: unknown;
	// Direction of play; defaults to true (clockwise).
	clockwise?: unknown;
}

const asStringArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const asStringNumberMap = (value: unknown): Record<string, number> => {
	if (!value || typeof value !== 'object') return {};
	const out: Record<string, number> = {};
	each(value as Record<string, unknown>, (v, k) => {
		if (typeof v === 'number') out[k] = v;
	});
	return out;
};

const asStringStringArrayMap = (value: unknown): Record<string, string[]> => {
	if (!value || typeof value !== 'object') return {};
	const out: Record<string, string[]> = {};
	each(value as Record<string, unknown>, (v, k) => {
		out[k] = asStringArray(v);
	});
	return out;
};

const makeCard = (id: string): ICardAny | null => {
	const template = fullDeckObject[id];
	if (!template) return null;
	return instantiateCard(template);
};

const makeEventHand = (ids: string[]): ICardEvent[] => {
	const hand: ICardEvent[] = [];
	each(ids, (id) => {
		const card = makeCard(id);
		// Hands only ever hold event-type cards (incl. infect/thing).
		if (card && card.type === ECardType.event) hand.push(card);
	});
	return hand;
};

const makeDeck = (ids: string[]): ICardAny[] => {
	const deck: ICardAny[] = [];
	each(ids, (id) => {
		const card = makeCard(id);
		if (card) deck.push(card);
	});
	return deck;
};

const playerByNick = (game: Game, nickname: string): Player | undefined =>
	find(game.players, (p) => p.nickname === nickname);

export const applyE2ESetup = (gameServer: GameServer, game: Game, raw: IE2ESetupPayload) => {
	gameServer.ignoreChecks = true;

	const order = asStringArray(raw.players);
	const hands = asStringStringArrayMap(raw.hands);
	const things = asStringArray(raw.things);
	const infected = asStringArray(raw.infected);
	const quarantine = asStringNumberMap(raw.quarantine);
	const quarantineFresh = asStringArray(raw.quarantineFresh);

	// 1. Drop any non-base players accumulated by earlier scenarios (e.g. the
	//    "door" placeholders barricade inserts), keeping only the named base
	//    players so the game is a clean slate.
	const baseNicks = order.length ? order : Object.values(game.players).map((p) => p.nickname);
	const keepIds = new Set<string>();
	each(baseNicks, (nick) => {
		const p = playerByNick(game, nick);
		if (p) keepIds.add(p.id);
	});
	each(Object.keys(game.players), (id) => {
		if (!keepIds.has(id)) delete game.players[id];
	});

	// 2. Reset every kept player to a neutral, alive state.
	each(game.players, (p) => {
		p.hand = [];
		p.turnState = ETurnState.idle;
		p.currentAction = null;
		p.state = EPlayerState.dummy;
		p.quarantine = 0;
		p.quarantineFresh = false;
		p.isThing = false;
		p.isInfected = false;
	});

	// 3. Rebuild seating order.
	game.gameInProcess = true;
	game.turnContext = null;
	game.discardedDeck = makeDeck(asStringArray(raw.discarded));
	game.deck = makeDeck(asStringArray(raw.deck));
	game.isClockwise = raw.clockwise === undefined ? true : raw.clockwise === true;
	// Прошлый сценарий мог оставить панику на столе — новый начинается с чистого.
	game.panicCard = null;
	game.panicPlayerId = null;

	const orderedIds: string[] = [];
	each(baseNicks, (nick, idx) => {
		const p = playerByNick(game, nick);
		if (!p) return;
		p.color = String(idx);
		// Лицо — по месту за столом: сценарий должен быть повторим до картинки.
		p.avatar = String(idx % avatarsCount);
		orderedIds.push(p.id);
	});
	game.playersList = orderedIds;

	// 3b. Insert any requested doors (barricade placeholders) into the seating.
	const doors = Array.isArray(raw.doors) ? raw.doors : [];
	each(doors, (entry) => {
		const after = (entry && typeof entry === 'object') ? (entry as {after?: unknown}).after : undefined;
		if (typeof after !== 'string') return;
		const afterPlayer = playerByNick(game, after);
		if (!afterPlayer) return;
		const idx = game.playersList.indexOf(afterPlayer.id);
		if (idx === -1) return;
		const door = new Player({socket: null, playerState: EPlayerState.door});
		door.game = game;
		door.id = uniqueId('dver_');
		door.nickname = 'Дверь';
		game.players[door.id] = door;
		game.playersList.splice(idx + 1, 0, door.id);
	});

	// 4. Deal the crafted hands.
	each(hands, (ids, nick) => {
		const p = playerByNick(game, nick);
		if (!p) return;
		p.hand = makeEventHand(ids);
		each(p.hand, (card) => {
			if (card.id === 'thing') {
				p.isThing = true;
				p.isInfected = true;
			}
		});
	});

	// 5. Flags: the Thing, infected, quarantines.
	each(things, (nick) => {
		const p = playerByNick(game, nick);
		if (p) {
			p.isThing = true;
			p.isInfected = true;
		}
	});
	each(infected, (nick) => {
		const p = playerByNick(game, nick);
		if (!p) return;
		// Очередь заражения ведём и здесь: финальная шеренга строит по ней
		// заражённых (см. Game.infectPlayer), и заражённые «из коробки» должны в
		// ней стоять в том порядке, в каком их перечислил сценарий.
		if (!p.isInfected) p.infectedSeq = ++game.infectionSeq;
		p.isInfected = true;
	});
	each(quarantine, (count, nick) => {
		const p = playerByNick(game, nick);
		if (p) p.quarantine = count;
	});
	each(quarantineFresh, (nick) => {
		const p = playerByNick(game, nick);
		if (p) p.quarantineFresh = true;
	});

	// 6. Hand the turn to the chosen player and put them in the requested phase.
	const turnNick = typeof raw.turn === 'string' ? raw.turn : baseNicks[0];
	const turnPlayer = turnNick ? playerByNick(game, turnNick) : undefined;
	if (turnPlayer) {
		game.turnPlayerId = turnPlayer.id;
		// changeTurn resets all players to idle and puts the turn player in
		// inCardPick; we then promote to inCardAction unless the test wants to
		// drive the draw step explicitly.
		turnPlayer.turnState = ETurnState.idle;
		game.changeTurn(turnPlayer.id);
		if (raw.turnState !== 'inCardPick') {
			turnPlayer.changeTurnState(ETurnState.inCardAction);
		}
	}

	game.updateGame();
};

export const registerE2EHandlers = (gameServer: GameServer, socket: IGameSocket) => {
	if (process.env.NECHTO_E2E !== 'true') return;

	// Override THIS game's seed (every game is already seeded; this just pins it
	// to a known value) so a whole playthrough is reproducible. Call BEFORE
	// startGame. Also puts the server into clean real-game mode (no mock, checks
	// enabled) so the seeded playthrough is the genuine deal with conservation
	// checks.
	socket.on('e2eSeed', (payload: unknown) => {
		try {
			const seed = (payload as {seed?: unknown})?.seed;
			const player = gameServer.getPlayerBySocket(socket);
			if (player && player.game && typeof seed === 'number') {
				player.game.reseed(seed);
			}
			gameServer.isMock = false;
			gameServer.ignoreChecks = false;
		} catch (e) {
			console.error('[handler:e2eSeed] error:', e);
		}
	});
	socket.on('e2eSetup', (payload: unknown) => {
		try {
			const player = gameServer.getPlayerBySocket(socket);
			if (!player || !player.game) return;
			applyE2ESetup(gameServer, player.game, (payload ?? {}) as IE2ESetupPayload);
		} catch (e) {
			console.error('[handler:e2eSetup] error:', e);
		}
	});
	// Lets a spec read the resolved game/player ids if it wants server truth.
	socket.on('e2eState', (_payload: unknown) => {
		try {
			const player = gameServer.getPlayerBySocket(socket);
			if (!player || !player.game) return;
			const game = player.game;
			const players = filter(game.players, () => true).map((p) => {
				const handActions: Record<string, {menuType: string}[]> = {};
				each(p.hand, (c) => {
					if (c.uniqueId) handActions[c.uniqueId] = getCardActions(game, p, c).map((a) => ({menuType: a.menuType}));
				});
				return {
					id: p.id,
					nickname: p.nickname,
					turnState: p.turnState,
					quarantine: p.quarantine,
					state: p.state,
					hand: p.hand.map((c) => ({id: c.id, uniqueId: c.uniqueId})),
					handActions,
					currentAction: p.currentAction,
					isThing: p.isThing,
					isInfected: p.isInfected,
				};
			});
			socket.emit('e2eState', {
				gameId: game.id,
				turnPlayerId: game.turnPlayerId,
				playersList: game.playersList,
				deck: game.deck.map((c) => c.id),
				discarded: game.discardedDeck.map((c) => c.id),
				isClockwise: game.isClockwise,
				gameLog: game.gameLog.map((entry) => entry.text),
				players,
			});
		} catch (e) {
			console.error('[handler:e2eState] error:', e);
		}
	});
};
