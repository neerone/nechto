import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues, reduce, remove, filter} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotificationAction from 'shared/interfaces/notification';
import {formatHand} from 'server/formatters/formatHand';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {IFormatTradeContext} from 'shared/interfaces/common';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {getNextChainReactionPlayer} from 'server/helpers/cardActions/panic/chainReaction';

function formatEvent(type, payload) {
	return {
		type, payload
	}
}
export const formatStartGameEvent = ({ players }: {players: { [key:string]: Player }}) => {
	return formatEvent(EServerEventType.gameStarted, {})
};

const formatDeck = (game:Game) => {
	if (!game.deck) return [];
	return {
		count: game.deck.length,
		topCardType: game.deck[0] ? game.deck[0].type : null
	}
}

export const formatUpdateGameEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer }))
};

export const formatPlayerConnectedEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.playerConnected, formatUpdatePlayerPayload({ game, viewer }))
};

const formatTradeContext = (game: Game) : IFormatTradeContext[] => {
	/* TEST AREA */
/*	if (!game.playersList) return;
	let test= reduce(game.playersList, (acc, pId) => {
		const player = game.players[pId];
		const defensePlayer = game.getPlayerByPosition({playerId:pId, isNext:true});
		acc.push({
			offensePlayerId: pId,
			defensePlayerId: defensePlayer.id,
			isCardPicked: false
		})
		return acc;
	}, [])
	const host = find(game.players, {nickname:"хост"});
	const igrogriv = find(game.players, {nickname:"Генадий Игрогрив3"});
	test = filter(test, (trade) => { return trade.offensePlayerId !== host.id})
	if (host && igrogriv) {
		test.push({
			offensePlayerId: host.id,
			defensePlayerId: igrogriv.id,
			isCardPicked: false
		})
	}
	return test;*/
	/*test area*/

	if (!game.turnContext) return;
	const ctx: any = game.turnContext;
	switch (game.turnContext.type) {
		case ETurnContextType.chainReaction:
			return reduce(game.playersList, (acc, pId) => {
				const player = game.players[pId];
				if (player.turnState === ETurnState.inOffenseTrade && player.state !== EPlayerState.door) {

					const defensePlayer = getNextChainReactionPlayer({currentPlayer: player, game})
					acc.push({
						offensePlayerId: pId,
						defensePlayerId: defensePlayer.id,
						isCardPicked: false,
						type: game.turnContext.type,
					})
				}
				return acc;
			}, []);
		case ETurnContextType.trade:
			return [{
				offensePlayerId: ctx.offensePlayer ? ctx.offensePlayer.id : null,
				defensePlayerId: ctx.defensePlayer ? ctx.defensePlayer.id : null,
				isCardPicked: !!ctx.offenseCardId,
				type: game.turnContext.type,
			}];
		case ETurnContextType.burn:
		case ETurnContextType.positionswap:
			return [{
				offensePlayerId: ctx.offensePlayer ? ctx.offensePlayer.id : null,
				defensePlayerId: ctx.defensePlayer ? ctx.defensePlayer.id : null,
				type: game.turnContext.type,
			}]
	}
}

const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return {
		players: formatPlayers(game, viewer),
		turnPlayerId:  game.turnPlayerId,
		playersList:  game.playersList,
		isClockwise:  game.isClockwise,
		gameLog: game.gameLog,
		tradeContext: formatTradeContext(game),
		deck: formatDeck(game),
		currentAction: viewer.currentAction,
	}
};



const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;
	const isViewer = viewer.id === player.id;
	const isViewerThing = viewer.isThing;
	const isViewerInjured = viewer.isThing;

	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: player.isHost,
		isYou: player === viewer,
		hand: isViewer ? formatHand(game, player) : null,
		color: player.color,
		turnState: player.turnState,
		//isInjured: true,
		isInjured: player.isThing ? null : (isViewerThing || isViewer ? player.isInjured : null),
		//isThing: true,
		isThing: isViewerThing || isViewerInjured ? player.isThing : null,
		quarantine: player.quarantine,
	}
};

const formatPlayers = (game: Game, viewer: Player) => {
	return mapValues(game.players, formatPlayer(game, viewer))
};

export const formatPlayerConnectionSuccessEvent = ({player, game, players}: {player: Player, game: Game, players: { [key:string]: Player } }) => {
	return formatEvent(EServerEventType.gameConnectionSuccess, {
		game: {
			id: game.id
		},
		player: formatPlayer(game, player)(player),
		players: formatPlayers(game, player),
	})
}

const findGameHost = (game: Game) => {
	const hostPlayer = find(game.players, player => { return player.isHost });
	return hostPlayer
}

export const formatLobbyState = (gameServer: GameServer) => {
	return formatEvent(EServerEventType.lobbyUpdate, {
		games: map(gameServer.games, (game: Game) => {
			const hostPlayer = findGameHost(game);
			return {
				gameId: game.id,
				hostName: hostPlayer ? hostPlayer.nickname : 'ERROR'
			}
		})
	})
};

export const formatPlayerNotification = ({player, notification} : {player: Player, notification: INotificationAction}) => {
	return formatEvent(EServerEventType.notification, notification)
}
