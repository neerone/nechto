import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {each} from 'lodash';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const tenacityAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	const first = game.pickFirstEventCard();
	const second = game.pickFirstEventCard();
	const third = game.pickFirstEventCard();

	game.turnContext = {
		type: ETurnContextType.tenacityCardSelect,
		cards: [first, second, third],
		playerId: player.id,
	};
	player.changeTurnState(ETurnState.inCardActionProgress);
	discardCard({game, player, cardUniqueId: card.uniqueId});
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
        type: ENotificationAction.selectCard,
        cards: [first, second, third],
        text: `Выбери одну их этих карт`,
      },
    }));
};

export const tenacitySelect = ({game, player, cardUniqueId} : {game: Game, player: Player, cardUniqueId: string}) => {
	if (game.turnContext.type !== ETurnContextType.tenacityCardSelect) {
		throw new Error('Выбор упорства произошел без контекста tenacityCardSelect');
	}
	each(game.turnContext.cards, (card) => {
		if (card.uniqueId === cardUniqueId) {
			player.hand.push(card);
		} else {
			game.discardedDeck.push(card);
		}
	});
	game.addLog(`Игрок ${player.nickname} играет карту "Упорство"`);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inCardAction)
};
