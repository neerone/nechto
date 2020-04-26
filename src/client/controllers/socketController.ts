import {SocketIOClient} from 'socket.io-client';
import INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {EAppState, EGameState} from 'shared/enum/common';
import {EServerEventType} from 'shared/enum/enumServerEvents';



function handleGlobalEvents(socket, root: RootController) {
	socket.on(EServerEventType.gameConnectionSuccess, ({players, player, game}) => {
		root.state = EAppState.game;
		root.gameController.currentPlayerId = player.id;
		root.gameController.id = game.id;
		root.gameController.players = players
	});

	const updateGame = ({tradeContext, players, playersList, deck, gameLog, currentAction}) => {
		root.state = EAppState.game;
		root.gameController.players = players;
		root.gameController.playersList = playersList;
		root.gameController.deck = deck;
		root.gameController.tradeContext = tradeContext;
		root.gameController.currentAction = currentAction;
		root.gameController.gameLog = gameLog;
	};

	socket.on(EServerEventType.updateGame, updateGame);
	socket.on(EServerEventType.playerConnected, updateGame);
	socket.on(EServerEventType.gameStarted, () => {
		root.state = EAppState.game;
		root.gameController.state = EGameState.process;
	});

	socket.on(EServerEventType.lobbyUpdate, ({games}) => {
		root.launcherController.games = games;
	});

	socket.on(EServerEventType.notification, (notification: INotificationAction) => {
		root.gameController.notifications.push(notification);
	})
}

export default class SocketController {

	root: RootController;
	parent: RootController;
	socket: SocketIOClient.Socket;

	constructor(root, parent, socket: SocketIOClient.Socket) {
		this.root = root;
		this.parent = parent;
		this.socket = socket;
		handleGlobalEvents(socket, root)
	}

	sendToServer = (eventType, payload) => {
		this.socket.emit(eventType, payload)
	}

}
