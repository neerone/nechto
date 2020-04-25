import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {notifyPlayerDiscardCards} from 'server/helpers/cardActions/panic/forgetfulness';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';

export const blindDateAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog(`Паника: свидание вслепую. Игрок ${player.nickname} одну карту с руки на карту из колоды`);
	player.changeTurnState(ETurnState.inCardActionProgress);
	player.notify(formatPlayerNotification({
		player,
		notification: notifyPlayerDiscardCards({game, player})
	}));
	game.turnContext = {
		type: ETurnContextType.blindDateCardSelect,
		playerId: player.id,
	}
};


export const blindDateSelect = ({game, cardUniqueId, player}: {game:Game, player: Player, cardUniqueId: string}) => {
	console.log('BLIND DATE CARD UNIQUE', cardUniqueId)
	discardCard({game, player, cardUniqueId: cardUniqueId});
	const first = game.pickFirstEventCard();
	player.hand.push(first);
	game.turnContext = null;
	game.endTurn(player.id);
}
