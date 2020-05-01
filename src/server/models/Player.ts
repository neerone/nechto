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

export class Player {
	id = null;
	socket: any;
	state: EPlayerState = EPlayerState.dummy;
	turnState: ETurnState = ETurnState.idle;
	nickname: string = '';
	isOnline: boolean = true;
	isHost: boolean = false;
	color:string = '';
	game: Game = null;
	isYou: boolean;
	hand: ICardEvent[];
	isInjured: boolean = false;
	isThing: boolean = false;
	quarantine: number = 0;
	currentAction: INotificationAction;

	constructor({ socket, playerState = EPlayerState.dummy }) {
		this.state = playerState;
		if (playerState === EPlayerState.door) {
			return;
		}
		this.id = _.uniqueId('player_');
		this.socket = socket;
	}

	notify = (event) => {
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
			case ENotificationAction.selectCard:
			case ENotificationAction.turnCard:
			case ENotificationAction.defenseTradeCard:
			case ENotificationAction.offenseTradeCard:
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
				return this.processNotificationAction({ type: ENotificationAction.turnCard, text: 'Сбрось или сыграй карту' });
			case ETurnState.idle:
			case ETurnState.dead:
				return this.currentAction = null;
			default:
				return;
		}
	}

	interruptTrade = () => {
		if (!this.game.turnContext || this.game.turnContext.type !== ETurnContextType.trade || this.game.turnContext.offensePlayer !== this) {
			throw new Error(`Интеррупт произошел вне контекста trade у игрока ${this.nickname}`)
			return;
		}
		this.getCard(this.game.turnContext.offenseCard);
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

		const discardCardIndex = findIndex(this.hand, (card) => card.uniqueId === cardUniqueId);
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
	getCardById = (id) => {
		return find(this.hand, {id});
	};
	getCardByUniqueId = (uniqueId: string) : ICardEvent => {
		return find(this.hand, {uniqueId});
	};
	makeOffline = () => {
		this.isOnline = false;
	};



	getNeighbours = () => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const currentPlayerIndex = findIndex(game.playersList, (playerId) => this.id === playerId );
		const rightId = game.playersList[currentPlayerIndex + 1] || game.playersList[0];
		const leftId = game.playersList[currentPlayerIndex - 1] || game.playersList[game.playersList.length - 1];
		return [rightId, leftId];
	};

	getPlayabeNeighbours = (ignoreOptions?: { ignoreDoors:boolean, ignoreQuarantine:boolean }) : string[] => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const currentPlayerIndex = findIndex(game.playersList, (playerId) => this.id === playerId );
		const rightId = game.playersList[currentPlayerIndex + 1] || game.playersList[0];
		const leftId = game.playersList[currentPlayerIndex - 1] || game.playersList[game.playersList.length - 1];
		const rightPlayer = game.players[rightId];
		const leftPlayer = game.players[leftId];
		const nighbours = [rightPlayer, leftPlayer]
			.filter((p) => p.state !== EPlayerState.door && p.quarantine === 0)
			.map(p => p.id);
		return nighbours;
	};

	getAxeTargets = () => {
		const game = this.game;
		const neighbours = this.getNeighbours().filter((n:string) => {
			const neigbh = game.players[n];
			return neigbh.quarantine > 0 || neigbh.state === EPlayerState.door;
		});

		const axeTargets = [...neighbours];
		if (this.quarantine > 0) {
			axeTargets.push(this.id)
		}
		return axeTargets;
	}
	getAllPlayablePlayersExceptCurrent() {
		return this.game.playersList.filter(pId => {
			const iterPlayer = this.game.players[pId];
			return pId !== this.id && iterPlayer.quarantine === 0 && iterPlayer.state === EPlayerState.dummy;
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

	getNextAlivePlayer = () => {
		const nextPlayer = this.getNextPlayer();
		if (!nextPlayer.isAlive()) return nextPlayer.getNextAlivePlayer();
		return nextPlayer
	}

	getPrevPlayer = () => {
		return this.game.getPlayerByPosition({playerId: this.id, isNext:false});
	}
	getRandomCard = () => {
		const randomCard = shuffle(this.hand)[0];
		return randomCard;
	}
	getRandomPlayableCard = () => {
		const randomCard = shuffle(this.hand)[0];
		if (getCardActions(this.game, this, randomCard).length > 0) {
			return randomCard;
		}
		return this.getRandomPlayableCard();
	}
}
