import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ENotificationAction} from 'shared/enum/notifications';
import {clone, each, find} from 'lodash';
import {getCardActions} from 'server/formatters/formatCardActions';
import {EPlayerActionType} from 'shared/enum/playerActions';

import {ETurnContextType} from 'shared/enum/turnContextType';
import INotificationAction from 'shared/interfaces/notification';

export const notifyPlayerDiscardCards = ({game, player}: {game:Game, player:Player}) : INotificationAction => {
	const clonedPlayer = clone(player);
	clonedPlayer.turnState = ETurnState.inCardAction;
	const filteredCards = clonedPlayer.hand.filter(card => {
		const cardActions = getCardActions(game, clonedPlayer, card);
		const cardTrade = find(cardActions, { menuType: EPlayerActionType.cardDiscard});
		return !!cardTrade;
	});


	return {
		type: ENotificationAction.selectCard,
		cards: filteredCards,
		text:'Выбери одну из своих карт, чтобы поменять её на карту из колоды'
	}
};

export const forgetfullnessAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Паника! Забывчивость: Игрок меняет три карты с руки на три из колоды');
	player.changeTurnState(ETurnState.inCardActionProgress);


	player.notify(formatPlayerNotification({
		player,
		notification: notifyPlayerDiscardCards({game, player})
	}));


	game.turnContext = {
		type: ETurnContextType.forgetfullnessSelect,
		playerId: player.id,
		cards: [],
	}
};


export const forgetfullnessSelect = ({game, cardUniqueId, player}: {game:Game, player: Player, cardUniqueId: string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.forgetfullnessSelect) {
		throw new Error('Забывчивость зафакапилась')
	}
	//discardCard({game, player, cardUniqueId: cardUniqueId});
	player.discardCard(cardUniqueId)
	game.turnContext.cards.push(cardUniqueId);

	if (game.turnContext.cards.length < 3) {
		player.notify(formatPlayerNotification({
			player,
			notification: notifyPlayerDiscardCards({game, player})
		}));
		return;
	}

	const first = game.pickFirstEventCard();
	const second = game.pickFirstEventCard();
	const third = game.pickFirstEventCard();
	player.getCard(first);
	player.getCard(second);
	player.getCard(third);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade)
}
