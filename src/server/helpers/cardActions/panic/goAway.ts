import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ETurnState} from 'shared/enum/player';

export const goAwayAct = ({game, player} : {game: Game, player: Player}) => {
	game.addLog(`Паника "убирайся прочь": игрок ${player.nickname} меняется местами с любым игроком не на карантине.`)
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	if (allPlayersExeptCurrent.length === 0) {
		return game.endTurn(player.id)
	}
	game.turnContext = {
		type: ETurnContextType.oneTwoPersonSelect,
		playerId: player.id,
	}
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться местами'
      },
    }));
};

