import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const goAwayAct = ({game, player} : {game: Game, player: Player}) => {
	game.addLog(`Паника "убирайся прочь": игрок ${player.nickname} меняется местами с любым игроком не на карантине.`)
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	console.log('PLAYER NOTIFIED!!!', ENotification.playerSelect, player.nickname)
	game.turnContext = {
		type: ETurnContextType.oneTwoPersonSelect,
		playerId: player.id,
	}
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться местами'
      },
    }));
};

