import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const whiskeyAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inOffenseTrade);
    game.notifyAllPlayersExeptPlayer(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: player.hand as ICardEvent[],
		text: `${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`
      },
    }), player);
    game.addLog(`${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`);
};
