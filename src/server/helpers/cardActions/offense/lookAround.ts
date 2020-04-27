import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const lookAroundAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	//player.discardCard(card.uniqueId);
	player.discardCard(card.uniqueId);
	game.isClockwise = !game.isClockwise;
	player.changeTurnState(ETurnState.inCardActionProgress);
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
		cards: [getCard(EEventID.lookaround)],
		text: `${player.nickname} изменил направление хода`
      },
    }));
    game.addLog(`${player.nickname} изменил направление хода`);
    player.changeTurnState(ETurnState.inOffenseTrade)
};
