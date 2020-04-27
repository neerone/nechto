import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';


export const reelFishingRodsAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.positionswap,
		offensePlayer: player,
		defensePlayer: null,
	};
	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться местами'
      },
    }));
    game.addLog(`Игрок ${player.nickname} сматывает удочки`);
};

