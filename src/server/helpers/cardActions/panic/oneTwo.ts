import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ENotificationAction} from 'shared/enum/notifications';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {filter, find} from 'lodash';
import {debugLog} from 'server/helpers/util';

export const getPlayerByStep = ({game, currentPlayer, isNext, step}: {game:Game, currentPlayer:Player, step: number, isNext: boolean}) => {
	const nextPlayer = game.getPlayerByPosition({playerId: currentPlayer.id,isNext})
	if (step !== 0) {
		if (nextPlayer.state === EPlayerState.door) { return getPlayerByStep({game, currentPlayer: nextPlayer, isNext, step}) }
		step = step - 1;
		return getPlayerByStep({game, currentPlayer: nextPlayer, isNext, step})
	}
	if (nextPlayer.state === EPlayerState.door) { return getPlayerByStep({game, currentPlayer: nextPlayer, isNext, step}) }
	return nextPlayer
}

export const oneTwoAct = ({game, player}: {game:Game, player:Player}) => {
	player.changeTurnState(ETurnState.inCardActionProgress);
	game.addLog(`Паника: раз-два: игрок ${player.nickname} меняется местами с третьим игроком по часовой или против часовой стрелке`);
	const left = getPlayerByStep({game, currentPlayer:player, isNext: true, step:2});
	const right = getPlayerByStep({game, currentPlayer:player, isNext: false, step:2});

	const selectPlayersId = filter([left,right], pl => {
		return pl.quarantine === 0 && pl.id !== player.id
	}).map(p=>p.id);

	if (selectPlayersId.length === 0) {
		game.addLog('Игрок не меняется ни с кем, т.к нет удовлетворяющих условий');
		player.changeTurnState(ETurnState.inOffenseTrade);
		return;
	}

	player.notify(formatPlayerNotification({
		player,
		notification: {
			type: ENotificationAction.playerSelect,
			playersToSelect: selectPlayersId,
			text:'Выбери игрока для смены мест'
		}
	}));
	game.turnContext = {
		type: ETurnContextType.oneTwoPersonSelect,
		playerId: player.id,
	}
};


export const oneTwoPlayerSelect = ({game, selectedPlayerId, player}: {game:Game, player: Player, selectedPlayerId: string}) => {
	debugLog('SELECTED PLAYER ID', selectedPlayerId)
	const selectedPlayer = find(game.players, {id:selectedPlayerId});
	game.addLog(`Игрок ${player.nickname} меняется местами с ${selectedPlayer.nickname}`);
	game.swapPlayers(selectedPlayerId, player.id);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade);
};
