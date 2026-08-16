import * as _ from 'lodash';
import {find, findIndex} from 'lodash';
import {Game} from 'server/models/Game';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ICardEvent} from 'shared/interfaces/cards';
import {debugLog, shuffle} from 'server/helpers/util';
import {EEventID} from 'shared/enum/cards';
import {getCardActions} from 'server/formatters/formatCardActions';
import INotificationAction from 'shared/interfaces/notification';
import {processTurnContext} from 'server/helpers/playerHelpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {
	formatSoundNotification,
	formatTimerNotification,
	formatUpdateGameEvent,
} from 'server/formatters/formatOutgoingEvents';
import {EPlayerMark} from 'shared/enum/playerMarks';
import type {IGameSocket, IServerEvent} from 'shared/interfaces/socket';
import {toAnalyticsMark} from 'server/analytics/track';

export class Player {
	// Real players get a unique id; the door placeholder keeps '' (it is
	// identified by state === door, never looked up by id).
	id: string = '';
	socket: IGameSocket | null = null;
	state: EPlayerState = EPlayerState.dummy;
	turnState: ETurnState = ETurnState.idle;
	nickname: string = '';
	color:string = '';
	// Номер лица в списке аватарок (см. resources.avatars). Раздаётся на старте
	// партии, по одному на человека — им и залит его кружок за столом.
	avatar: string = '';
	// Always assigned via register() before the player participates in a game.
	game!: Game;
	isYou: boolean = false;
	hand: ICardEvent[] = [];
	isInfected: boolean = false;
	// Каким по счёту игрока заразили (см. Game.infectPlayer). 0 — не заражён либо
	// заражён не по ходу партии (Нечто с самой раздачи). По этому номеру заражённые
	// выстраиваются в финальной шеренге — в том порядке, в каком их и заражали.
	infectedSeq: number = 0;
	isThing: boolean = false;
	quarantine: number = 0;
	// True for the turn-cycle in which a quarantine was just applied, so the
	// counter doesn't tick on the very turn-start that immediately follows.
	quarantineFresh: boolean = false;
	isReady: boolean = false;
	// True for server-driven emulated opponents (the ?withBots=true dev mode).
	isBot: boolean = false;
	currentAction: INotificationAction | null = null;
	isConnected: boolean = true;
	marks: {[key:string]: EPlayerMark} = {};

	constructor({ socket, playerState = EPlayerState.dummy }: { socket?: IGameSocket | null; playerState?: EPlayerState }) {
		this.state = playerState;
		if (playerState === EPlayerState.door) {
			return;
		}
		this.id = _.uniqueId('player_');
		this.socket = socket ?? null;
	}

	notify = (event: IServerEvent) => {
		if (event.type === 'notification') {
			this.processNotificationAction(event.payload as INotificationAction);
		}
		if (!this.socket) return;
		this.socket.emit(event.type, event.payload);
	};

	processNotificationAction(notificationAction: INotificationAction) {
		switch (notificationAction.type) {
			case ENotificationAction.actionDecision:
			case ENotificationAction.playerSelect:
			case ENotificationAction.selectCards:
			case ENotificationAction.turnCard:
			case ENotificationAction.defenseTradeCard:
			case ENotificationAction.offenseTradeCard:
			case ENotificationAction.cardPick:
				this.currentAction = notificationAction;
				return
		}
	}

	processTurnState(turnState: ETurnState) {
		switch (turnState) {
			case ETurnState.inDefenseTrade:
				return this.processNotificationAction({ type: ENotificationAction.defenseTradeCard, text: 'Выбери карту для обмена или сыграй отказ' });
			case ETurnState.inOffenseTrade:
				return this.processNotificationAction({ type: ENotificationAction.offenseTradeCard, text: 'Выбери карту для обмена' });
			case ETurnState.inCardAction:
				// На карантине из карт играется только топор (он же карантин и снимает),
				// поэтому подпись действия должна объяснять, почему остальные карты не жмутся.
				return this.processNotificationAction({
					type: ENotificationAction.turnCard,
					text: this.quarantine > 0
						? 'Ты на карантине: можешь сыграть только топор или сбросить карту'
						: 'Сбрось или сыграй карту',
				});
			case ETurnState.inCardPick:
				return this.processNotificationAction({ type: ENotificationAction.cardPick, text: 'Возьми карту из колоды' });
			case ETurnState.idle:
			case ETurnState.dead:
				return this.currentAction = null;
			default:
				return;
		}
	}

	processTimer(turnState: ETurnState) {
		const {game} = this;
		const isChainReaction = !!game.turnContext && game.turnContext.type === ETurnContextType.chainReaction;
		let timerNotification: { text: string; seconds: number } | null = null;
		if (isChainReaction) {
			timerNotification = { text: `${this.nickname} все передают карту по кругу`, seconds: 30 };
		} else {
			switch (turnState) {
				case ETurnState.inDefenseTrade:
				case ETurnState.inOffenseTrade:
					timerNotification = { text: `${this.nickname} выбирает карту`, seconds: 30 };
					break;
				case ETurnState.inCardAction:
					timerNotification = { text: `${this.nickname} играет карту`, seconds: 10 };
					break;
				case ETurnState.inCardPick:
					timerNotification = { text: `${this.nickname} берет карту`, seconds: 10 };
					break;
				default:
					return;
			}
		}
		if (!timerNotification) return;
		// Гонг зовёт игрока к столу, а не отсчитывает этапы хода. Раньше он звучал
		// на каждом этапе, где заводится таймер, то есть трижды за свой ход: взять
		// карту, сыграть, обменяться. Но на втором и третьем игрок уже за столом и
		// сам только что нажал кнопку — гонг там звенит в ответ на его же действие.
		//
		// Остаются те случаи, когда очередь доходит до игрока неожиданно для него:
		// начало собственного хода, защита от чужой карты и цепная реакция.
		const callsToTable = isChainReaction
			|| turnState === ETurnState.inCardPick
			|| turnState === ETurnState.inDefenseTrade;
		if (callsToTable) this.notify(formatSoundNotification());
		// playerId — чей это таймер: рассылка идёт всем, а клиент по нему понимает,
		// свой ли ход отсчитывается (в заголовке вкладки показываем только свой).
		this.game.notifyAllPlayers(formatTimerNotification({...timerNotification, playerId: this.id}));
	}

	interruptTrade = () => {
		if (!this.game.turnContext || this.game.turnContext.type !== ETurnContextType.trade || this.game.turnContext.offensePlayer !== this) {
			throw new Error(`Интеррупт произошел вне контекста trade у игрока ${this.nickname}`)
		}
		const offenseCard = this.game.turnContext.offenseCard;
		if (offenseCard) this.getCard(offenseCard);
		this.game.endTurn(this.id);
	}

	changeTurnState = (newTurnState: ETurnState) => {
		debugLog(`Игрок ${this.nickname} пытается стать ${newTurnState}, а был ${this.turnState}`)
		if (!this.game.gameInProcess) return;
		if (this.state === EPlayerState.door) return;
		if (this.turnState === newTurnState) return;
		this.turnState = newTurnState
		debugLog(`Игрок ${this.nickname} теперь ${newTurnState}`)
		this.processTurnState(newTurnState);
		this.processTimer(newTurnState);
		processTurnContext({player:this, turnState: newTurnState});
	};

	isAlive() {
		if (this.state===EPlayerState.door) return false;
		if (this.turnState===ETurnState.dead) return false;
		return true;
	}


	isOverInfected() {
		//Если у игрока на руке оказались все карты заражения, он умирает
		if (this.isThing) return false;
		if (!this.hand.length) return false;
		const cleanCard = find(this.hand, card => card.id !== EEventID.infect);
		if (!cleanCard) {
			return true
		}
		return false;
	}

	getCard(card: ICardEvent) {
		this.hand.push(card);
		debugLog(`Игрок ${this.nickname} получил карту ${card.id}`)
		//this.checkOverInfect();
	}

	discardCard(cardUniqueId: string) {
		const game = this.game;
		if (!game.gameInProcess) return;
		const card = this.getCardByUniqueId(cardUniqueId);
		if (!card) return;

		const discardCardIndex = findIndex(this.hand, (handCard) => handCard.uniqueId === cardUniqueId);
		debugLog(`Игрок ${this.nickname} убрал в колоду ${card.id}`)
		this.game.discardedDeckPush(card);
		this.hand.splice(discardCardIndex, 1);
		//this.checkOverInfect();
	}

	register = ({nickname, game}: {nickname:string, game: Game}) => {
		this.nickname = nickname;
		this.game = game;
		game.connectPlayer({player: this});
	};
	getCardById = (id: EEventID): ICardEvent | undefined => {
		return find(this.hand, {id});
	};
	getCardByUniqueId = (uniqueId: string) : ICardEvent | undefined => {
		return find(this.hand, {uniqueId});
	};

	makeOffline = () => {
		this.isConnected = false;
		if (this.game) {
			this.game.disconnectPlayer({player: this})
		}
	};



	private neighbourIds = (): string[] => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const i = findIndex(game.playersList, (playerId) => this.id === playerId);
		const rightId = game.playersList[i + 1] ?? game.playersList[0];
		const leftId = game.playersList[i - 1] ?? game.playersList[game.playersList.length - 1];
		return [rightId, leftId].filter((id): id is string => !!id);
	};

	getNeighbours = (): string[] => this.neighbourIds();

	getPlayabeNeighbours = (): string[] => {
		const game = this.game;
		return this.neighbourIds()
			.map((id) => game.players[id])
			.filter((p): p is Player => !!p && p.state !== EPlayerState.door && p.quarantine === 0)
			.map((p) => p.id);
	};

	getAxeTargets = (): string[] => {
		const game = this.game;
		const neighbours = this.neighbourIds().filter((n) => {
			const neigh = game.players[n];
			return !!neigh && (neigh.quarantine > 0 || neigh.state === EPlayerState.door);
		});

		const axeTargets = [...neighbours];
		if (this.quarantine > 0) {
			axeTargets.push(this.id)
		}
		return axeTargets;
	}
	getAllPlayablePlayersExceptCurrent(): string[] {
		return this.game.playersList.filter(pId => {
			const iterPlayer = this.game.players[pId];
			return !!iterPlayer && pId !== this.id && iterPlayer.quarantine === 0 && iterPlayer.state === EPlayerState.dummy;
		});
	}
	getCardTargets = (card: ICardEvent) => {
		switch (card.id) {
			case EEventID.barricade:
			case EEventID.flamethrower:
			case EEventID.positionswap:
			case EEventID.analysis:
			case EEventID.suspicion:
				return this.getPlayabeNeighbours();
			case EEventID.seduction:
			case EEventID.reelFishingRods:
				return this.getAllPlayablePlayersExceptCurrent();
			case EEventID.axe:
				return this.getAxeTargets();
			case EEventID.quarantine:
				return [...this.getPlayabeNeighbours(), this.id]
		}
		return [];
	};

	isCardNonTarget = (card: ICardEvent) => {
		switch (card.id) {
			case EEventID.tenacity:
			case EEventID.lookaround:
			case EEventID.whiskey:
				return true;
		}
		return false;
	};

	getNextPlayer = () => {
		if (!this.game) {
			debugLog('GAME Не задан у игрока', this.nickname)
			throw new Error()
		}
		return this.game.getPlayerByPosition({playerId: this.id, isNext:true});
	}

	getNextAlivePlayer = (): Player => {
		const nextPlayer = this.getNextPlayer();
		if (!nextPlayer.isAlive()) return nextPlayer.getNextAlivePlayer();
		return nextPlayer
	}

	getPrevPlayer = (): Player => {
		return this.game.getPlayerByPosition({playerId: this.id, isNext:false});
	}
	getRandomCard = (): ICardEvent | undefined => {
		const randomCard = shuffle(this.hand, this.game.rng)[0];
		return randomCard;
	}
	getRandomPlayableCard = (): ICardEvent | undefined => {
		const randomCard = shuffle(this.hand, this.game.rng)[0];
		if (!randomCard) return undefined;
		if (getCardActions(this.game, this, randomCard).length > 0) {
			return randomCard;
		}
		return this.getRandomPlayableCard();
	}

	toggleReady = () => {
		this.isReady = !this.isReady;
		this.game.updateGame();
		//this.game.notifyAllPlayers(formatPlayerConnectedEvent({viewer: this, game: this.game}))
	}

	markPlayer = (markPlayerId: string) => {
		const previousMark = this.marks[markPlayerId];
		const nextMark = getNextMark(previousMark);
		this.marks[markPlayerId] = nextMark;
		// Статусы — главное, что аналитика знает о том, кто что думал: пишем и
		// сам статус, и кем цель была на самом деле в эту секунду.
		const target = this.game ? this.game.players[markPlayerId] : undefined;
		const analyticsMark = toAnalyticsMark(nextMark);
		if (target && analyticsMark) {
			this.game.analytics.mark({
				actor: this,
				target,
				mark: analyticsMark,
				previousMark: toAnalyticsMark(previousMark),
			});
		}
		this.notify(formatUpdateGameEvent({game: this.game, viewer: this}));
	}

}


function getNextMark(currentMark: EPlayerMark | undefined) {
	switch (currentMark) {
		case undefined:
			return EPlayerMark.clear;
		case EPlayerMark.clear:
			return EPlayerMark.question;
		case EPlayerMark.question:
			return EPlayerMark.infected;
		case EPlayerMark.infected:
			return EPlayerMark.thing;
		case EPlayerMark.thing:
			return EPlayerMark.none;

	}
	return EPlayerMark.clear;
}
