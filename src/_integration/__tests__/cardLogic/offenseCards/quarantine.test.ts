import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {requirePlayer} from '_integration/helpers';


describe('quarantine test',  () => {

	it('quarantine card self', () => {
		const [gameServer, game, offensePlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		if (!quarantine) throw new Error('quarantine card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: offensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.quarantine).toBe(3);

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		const nextPlayer = game.getPlayerByPosition({playerId: offensePlayer.id, isNext: true});
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction)
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('quarantine card next', () => {
		const [gameServer, game, offensePlayerMaybe, nextPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const nextPlayer = requirePlayer(game, nextPlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		if (!quarantine) throw new Error('quarantine card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: nextPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(nextPlayer.quarantine).toBe(3);

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('quarantine card prev', () => {
		const [gameServer, game, offensePlayerMaybe, , , , , prevPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const prevPlayer = requirePlayer(game, prevPlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		if (!quarantine) throw new Error('quarantine card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});


		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: prevPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(prevPlayer.quarantine).toBe(3);

		// Quarantine was applied to the PREVIOUS neighbour, so the next neighbour
		// (the regular trade partner) is still clean: the offense player proceeds
		// to the normal end-of-turn trade rather than ending immediately.
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);
		expect(offensePlayer.hand.length).toBe(4);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	// «Следующие 3 своих хода» — ход, на котором выпала паника, такой же ход
	// карантина, как и ход с картой события: счетчик обязан вести себя одинаково.
	// Раньше паника тикала мимо quarantineFresh, и первый замок слетал сразу же,
	// а несколько паник подряд выпускали игрока из карантина на ход раньше.
	it('карантин тикает одинаково с паникой и с картой события', () => {
		const [, game, , nextPlayerMaybe] = createMockGameServer();
		const nextPlayer = requirePlayer(game, nextPlayerMaybe?.id);
		nextPlayer.quarantine = 3;
		nextPlayer.quarantineFresh = true;

		const drawPanic = () => {
			game.deck.splice(0, 1, getPanic(EPanicID.threeFour));
			game.changeTurn(nextPlayer.id);
		};

		// Первый свой ход после розыгрыша карты: счетчик не трогаем, но карантин
		// уже действует.
		drawPanic();
		expect(nextPlayer.quarantine).toBe(3);
		expect(nextPlayer.quarantineFresh).toBe(false);

		drawPanic();
		expect(nextPlayer.quarantine).toBe(2);

		// Третий ход — все еще под карантином.
		drawPanic();
		expect(nextPlayer.quarantine).toBe(1);

		// Четвертый — вышел.
		drawPanic();
		expect(nextPlayer.quarantine).toBe(0);
	});
});
