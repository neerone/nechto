import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

export const oopsAct = ({game, player} : {game: Game, player: Player}) => {
    game.addLog(`${player.nickname} как бы случайно показывает все карты.`)
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: player.hand as ICardEvent[],
		text: `${player.nickname}: УУУПС!`
      },
    }));

	player.changeTurnState(ETurnState.inOffenseTrade);
};
