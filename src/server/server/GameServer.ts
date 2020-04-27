import { Game } from "server/models/Game";
import { Player } from "server/models/Player";
import {EPlayerActionType} from 'shared/enum/playerActions';
import {formatLobbyState} from 'server/formatters/formatOutgoingEvents';

class GameServer {
  games: { [key: string]: Game } = {};
  players: { [key: string]: Player } = {};
  isMock: boolean = false;
  io: any;
  initialize(io) {
    this.io = io;
  }

  broadcast = ({ roomName, event }) => {
    this.io.to(roomName).emit(event.type, event.payload);
  };

  getPlayerById(id) {
    return this.players[id] || null;
  }
  initPlayer(socket) {
    const player = new Player({ socket });
    this.players[player.id] = player;
    player.notify(formatLobbyState(gameServer));
    return player;
  }

  createGame({ player, nickname }: { player: Player; nickname: string }) {
    const game = new Game({ player });
    player.isHost = true;
    player.register({ nickname, game });
    this.games[game.id] = game;
    return game;
  }

  connectGame({nickname, player, gameId}: { player: Player; nickname: string, gameId: string }) {
    const parsedGameId = gameId.trim();
    const game = this.games[parsedGameId] || this.games['game_' + parsedGameId];
    if (!game) return;
    player.register({ nickname, game });
  }

  startGame({player}: {player:Player}) {
    player.game.start();
  }

  kickPlayer({playerId}) {
    const player = this.getPlayerById(playerId);
    const game = player.game;
    game.disconnectPlayer({player});
  }
  getGameById(id) {
    return this.games[id] || null;
  }
  destroyGame(id) {
    this.games[id].destroy();
  }

  playerAction({
    player,
    actionType,
    selectedPlayerId,
    cardUniqueId,
    action
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId?: string,
    selectedPlayerId?:string,
    action?: string
  }) {
    player.game.cardAction({player, actionType, cardUniqueId, selectedPlayerId, action})
  }
/*  actionDecision({player, action}) {
    player.game.actionDecision({player, action})
  }*/
}

const gameServer = new GameServer();
export { gameServer, GameServer };
