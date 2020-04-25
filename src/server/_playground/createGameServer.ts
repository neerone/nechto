import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocketServer, createPlayer} from 'server/_playground/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';

export const createMockGameServer = (): [GameServer, Game, ...Player[]] => {
	//const gameServer = new GameServer();
	gameServer.isMock = true;
	gameServer.initialize(createMockSocketServer());
	const neeronePlayer = createPlayer();
	const game = gameServer.createGame({nickname: 'neerone', player: neeronePlayer});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Вася'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'Вена'});
	gameServer.startGame({player: neeronePlayer});
	return [gameServer, game, ...map(game.players, (p => p))]
}
