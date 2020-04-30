import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';

import {ETurnContextType} from 'shared/enum/turnContextType';
import {notifyPlayerDiscardCards} from 'server/helpers/cardActions/panic/forgetfulness';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {debugLog} from 'server/helpers/util';

export const blindDateAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog(`Паника: свидание вслепую. Игрок ${player.nickname} меняет одну карту с руки на карту из колоды`);
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
	debugLog('BLIND DATE CARD UNIQUE', cardUniqueId)
	//discardCard({game, player, cardUniqueId: cardUniqueId});
	player.discardCard(cardUniqueId);
	const first = game.pickFirstEventCard();
	player.getCard(first);
	game.turnContext = null;
	game.endTurn(player.id);
}
