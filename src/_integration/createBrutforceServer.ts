import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocketServer, createPlayer} from '_integration/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';

export const createBrutforceServer = (isTestTag = true): [GameServer, Game, ...Player[]] => {
	//const gameServer = new GameServer();
	gameServer.isMock = false;
	gameServer.initialize(createMockSocketServer());
	const neeronePlayer = createPlayer();
	const game = gameServer.createGame({nickname: 'neerone', player: neeronePlayer});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Вася'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Гуля'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Саша'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Гиря'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Пиво'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Диво'});





	gameServer.startGame({player: neeronePlayer});
	return [gameServer, game, ...map(game.players, (p => p))]
}
