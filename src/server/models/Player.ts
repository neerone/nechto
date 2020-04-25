import * as _ from 'lodash';
import {find, findIndex} from 'lodash';
import {Game} from 'server/models/Game';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ICardEvent} from 'shared/interfaces/cards';
import {shuffle} from 'server/helpers/util';
import {EEventID} from 'shared/enum/cards';
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

	constructor({ socket, playerState = EPlayerState.dummy }) {
		this.state = playerState;
		if (playerState === EPlayerState.door) {
			return;
		}
		this.id = _.uniqueId('player_');
		this.socket = socket;
	}
	notify = (event) => {
		if (!this.socket) return;
		this.socket.emit(event.type, event.payload);
	};
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

	changeTurnState = (newTurnState: ETurnState) => {
		if (this.state === EPlayerState.door) return;
		this.turnState = newTurnState
		if (this.turnState === ETurnState.inOffenseTrade) {
			const context = this.game.turnContext;
			let playerToTrade: Player | null =  null;
			if (context && context.type === ETurnContextType.trade && context.defensePlayer) {
				playerToTrade = context.defensePlayer
			} else {
				playerToTrade = this.game.getPlayerByPosition({playerId: this.id, isNext: true});
			}
		    if (playerToTrade.state === EPlayerState.door && !this.game.turnContext) {
				this.game.addLog(`Игрок ${this.nickname} не меняется из-за заколоченной двери`);
				this.game.endTurn(this.id);
				return
		    }
		    if (this.game.turnContext === null) {
			    this.game.turnContext = {
			      type: ETurnContextType.trade,
			      defensePlayer: playerToTrade,
			      offensePlayer: this,
			      offenseCardId: null,
			    };
		    }
		}
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
		return this.game.getPlayerByPosition({playerId: this.id, isNext:true});
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
		if (randomCard.id === EEventID.thing) return this.getRandomPlayableCard();
		return randomCard;
	}
}
