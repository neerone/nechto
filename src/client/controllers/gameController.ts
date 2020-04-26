import {computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType} from 'shared/enum/cards';
import {EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {IFormatTradeContext} from 'shared/interfaces/common';


export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: {[key: string]: Player | null } = {};
	@observable currentPlayerId : string | null = null;
	@observable playersList: string[] = [];
	@observable gameLog: string[] = [];
	@observable deck: {count: number, topCardType: ECardType} = {count: 0, topCardType: ECardType.event};
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	@observable isLayoutSequential: boolean = false;
	@observable tradeContext: IFormatTradeContext[] | null = null;
	@observable currentAction: INotificationAction | null = null;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
	}

	@computed get currentPlayer(): Player | null {
		if (!this.currentPlayerId) return null;
		return this.players[this.currentPlayerId] || null;
	}

	initialize({ players }: {players: {[key: string]: Player}}) {
		this.players = players;
	};

	kickPlayer = (playerId) => {
		this.socket.sendToServer(EClientEventType.kickPlayer, { playerId })
	};

	startGame = () => {
		this.socket.sendToServer(EClientEventType.startGame, {})
	};


	cardAction = (actionType: EPlayerActionType, cardUniqueId: string) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType, cardUniqueId})
	};

	activatePlayerSelectMode = (notification) => {
		this.playersToSelect = notification.playersToSelect;
		this.notifications.splice(0, 1);
	};

	hidENotificationAction = () => {
		this.notifications.splice(0, 1);
	};

	selectCard = (notification, cardUniqueId) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardSelect, actionContext: notification, cardUniqueId});
		this.hidENotificationAction();
	};

	selectPlayer = (playerId: string ) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.playerSelect, selectedPlayerId: playerId});
	};

	actionDecision = (action: string ) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.actionDecision, {actionType: EPlayerActionType.actionDecision, action});
		this.hidENotificationAction();
	};
	toggleRoomLayout = () => {
		this.isLayoutSequential = !this.isLayoutSequential;
	}

}
