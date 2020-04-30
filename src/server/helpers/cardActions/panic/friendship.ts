import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ETurnState} from 'shared/enum/player';


export const friendshipAct = ({game, player} : {game: Game, player: Player}) => {
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	if (allPlayersExeptCurrent.length === 0) {
		return game.endTurn(player.id)
	}
	game.turnContext = {
		type: ETurnContextType.seduction,
		offensePlayer: player,
		defensePlayer: null
	};
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться картами'
      },
    }));
    game.addLog(`Игрок ${player.nickname} играет панику "Давай дружить"`);
};
