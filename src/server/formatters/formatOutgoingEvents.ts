import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues, reduce, filter, sortBy} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotificationAction from 'shared/interfaces/notification';
import {formatHand} from 'server/formatters/formatHand';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {IFormatPanicCard, IFormatTradeContext} from 'shared/interfaces/common';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {getNextChainReactionPlayer} from 'server/helpers/cardActions/panic/chainReaction';
import {getCardActions} from 'server/formatters/formatCardActions';
import {isPlayerCanCancel} from 'server/helpers/validators';
import {EGameState} from 'shared/enum/common';

function formatEvent(type: string, payload?: unknown) {
	return {
		type, payload
	}
}
export const formatStartGameEvent = (_args: {players: { [key:string]: Player }}) => {
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

/*export const formatPlayerConnectedEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.playerConnected, formatUpdatePlayerPayload({ game, viewer }))
};*/

const formatTradeContext = (game: Game) : IFormatTradeContext[] | undefined => {
	const turnContext = game.turnContext;
	if (!turnContext) return undefined;
	switch (turnContext.type) {
		case ETurnContextType.chainReaction: {
			const ctxType = turnContext.type;
			return reduce(game.playersList, (acc: IFormatTradeContext[], pId) => {
				const player = game.players[pId];
				if (player && player.turnState === ETurnState.inOffenseTrade && player.state !== EPlayerState.door) {
					const defensePlayer = getNextChainReactionPlayer({currentPlayer: player, game})
					acc.push({
						offensePlayerId: pId,
						defensePlayerId: defensePlayer ? defensePlayer.id : null,
						isCardPicked: false,
						type: ctxType,
					})
				}
				return acc;
			}, []);
		}
		case ETurnContextType.trade:
			return [{
				offensePlayerId: turnContext.offensePlayer ? turnContext.offensePlayer.id : null,
				defensePlayerId: turnContext.defensePlayer ? turnContext.defensePlayer.id : null,
				isCardPicked: !!turnContext.offenseCard,
				type: turnContext.type,
			}];
		case ETurnContextType.burn:
		case ETurnContextType.positionswap:
		case ETurnContextType.cardsView:
			return [{
				offensePlayerId: turnContext.offensePlayer ? turnContext.offensePlayer.id : null,
				defensePlayerId: turnContext.defensePlayer ? turnContext.defensePlayer.id : null,
				cardId: turnContext.cardId,
				type: turnContext.type,
			}]
	}
	return undefined;
}

// Сработавшая паника, пока её событие идёт: стол показывает эту карту крупно в
// центре и не даёт тянуть новую, пока она там (см. Game.syncPanicCard).
const formatPanicCard = (game: Game) : IFormatPanicCard | null => {
	const panicCard = game.panicCard;
	if (!panicCard) return null;
	return {
		id: panicCard.id,
		uniqueId: panicCard.uniqueId ?? null,
	};
};

const getPlayerHand = (game: Game, viewer:Player) => {
	return formatHand(game, viewer);
}
const getPlayerHandActions = (game: Game, viewer:Player) => {
	const hand = getPlayerHand(game, viewer);
	return reduce(hand, (acc: Record<string, ReturnType<typeof getCardActions>>, card) => {
		if (card.uniqueId) acc[card.uniqueId] = getCardActions(game, viewer, card);
		return acc
	}, {})

}
const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return {
		hostPlayerId: game.hostPlayerId,
		state: game.state,
		currentPlayer: formatPlayer(game, viewer)(viewer),
		players: formatPlayers(game, viewer),
		hand: getPlayerHand(game, viewer),
		handActions: getPlayerHandActions(game, viewer),
		turnPlayerId:  game.turnPlayerId,
		playersList:  game.playersList,
		isClockwise:  game.isClockwise,
		gameLog: game.gameLog,
		tradeContext: formatTradeContext(game),
		cardEffects: game.cardEffects,
		cardDraws: game.cardDraws,
		panicCard: formatPanicCard(game),
		deck: formatDeck(game),
		currentAction: viewer.currentAction,
		isPlayerCanCancel: isPlayerCanCancel(game, viewer),
	}
};



const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;
	const isViewer = viewer.id === player.id;
	const isViewerThing = viewer.isThing;
	// Заражённый — это не-нечто с заражением: у самого нечто своя, полная картина.
	// Заразить может только нечто, поэтому заражённому достаточно видеть его
	// одного: это и есть тот, кто его заразил. Остальные заражённые для него
	// неотличимы от чистых.
	const isViewerInfected = viewer.isInfected && !viewer.isThing;

	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: game.hostPlayerId === player.id,
		isYou: player === viewer,
		color: player.color,
		avatar: player.avatar,
		turnState: player.turnState,
		isInfected: player.isThing ? null : (isViewerThing || isViewer ? player.isInfected : null),
		isThing: isViewerThing || isViewerInfected ? player.isThing : null,
		quarantine: player.quarantine,
		isReady: player.isReady,
		isConnected: player.isConnected,
		marks: isViewer ? player.marks : null,
	}
};

const formatPlayers = (game: Game, viewer: Player) => {
	return mapValues(game.players, formatPlayer(game, viewer))
};

// Финальные шеренги: команда Нечто и команда людей, каждая целиком — с теми, кто
// до конца не дожил (клиент их затеняет). Роли здесь настоящие: партия доиграна,
// и прятать их больше не от кого, а без этого весь экран и не собрать —
// formatPlayer до последнего кадра стола отдаёт их пустыми.
//
// Внутри команды порядок не случайный, иначе шеренга ничего не рассказывает:
// Нечто стоит впереди своих заражённых, а те — в порядке заражения (см.
// Player.infectedSeq). Люди стоят так, как сидели за столом.
export const formatGameEndTeams = (game: Game) => {
	const formatOne = (player: Player) => ({
		id: player.id,
		nickname: player.nickname,
		avatar: player.avatar,
		isThing: player.isThing,
		isInfected: player.isInfected && !player.isThing,
		isAlive: player.isAlive(),
	});
	// Двери — не игроки, а лежащие на столе карты: в шеренгах им делать нечего.
	const seated = filter(game.players, (player) => !!player && player.state !== EPlayerState.door);
	const thingTeam = map(
		sortBy(filter(seated, (player) => player.isThing || player.isInfected), (player) => player.isThing ? -1 : player.infectedSeq),
		formatOne,
	);
	const humanTeam = map(filter(seated, (player) => !player.isThing && !player.isInfected), formatOne);
	return {thingTeam, humanTeam};
};

/*export const formatPlayerConnectionSuccessEvent = ({player, game, players}: {player: Player, game: Game, players: { [key:string]: Player } }) => {
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer:player }))
	return formatEvent(EServerEventType.gameConnectionSuccess, {
		currentPlayer: formatPlayer(game, player)(player),
		state: game.state,
		game: {
			id: game.id
		},
		player: formatPlayer(game, player)(player),
		players: formatPlayers(game, player),
	})
}*/

const getGameHost = (game: Game) => {
	const hostPlayer = find(game.players, player => { return player.id === game.hostPlayerId });
	return hostPlayer
}

export const formatLobbyState = (gameServer: GameServer) => {
	const filteredGames = filter(gameServer.games, {gameInProcess:true})
	return formatEvent(EServerEventType.lobbyUpdate, {
		games: map(filteredGames, (game: Game) => {
			const hostPlayer = getGameHost(game);
			return {
				gameId: game.id,
				hostName: hostPlayer ? hostPlayer.nickname : 'ERROR',
				// Двери — служебные «игроки» стола, в счётчик комнаты они не идут.
				playersCount: filter(game.players, (player: Player) => player.state !== EPlayerState.door).length,
				isStarted: game.state === EGameState.sarted,
			}
		})
	})
};


export const formatPlayerNotification = ({notification} : {player: Player, notification: INotificationAction}) => {
	return formatEvent(EServerEventType.notification, notification)
}

export const formatCommonError = (errorMessage: string) => {
	return formatEvent(EServerEventType.commonError, {
		error: errorMessage,
	})
};

export const formatSoundNotification = () => {
	return formatEvent(EServerEventType.soundNotification, {
	})
};

export const formatTimerNotification = (timerPayload: { text: string; seconds: number; playerId: string }) => {
	return formatEvent(EServerEventType.timerNotification, timerPayload)
};
