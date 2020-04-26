import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const quarantineAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.quarantinePersonSelect,
		playerId: player.id,
	};

	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: [...player.getPlayabeNeighbours(), player.id],
		text: 'Выбри на кого хочешь применить карантин'
      },
    }));
};

export const quarantineSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.quarantinePersonSelect) {
		throw new Error('Выбор quarantine произошел без контекста quarantinePersonSelect');
	}
	const selectedPlayer = game.players[selectedPlayerId];
	selectedPlayer.quarantine = 3;
	game.turnContext = null;
	game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
		text: `Игрок ${selectedPlayer.nickname} теперь на карантине`,
		cards: [getCard(EEventID.quarantine)]
      },
    }));
	game.addLog(`Игрок ${selectedPlayer.nickname} теперь на карантине`);
	player.changeTurnState(ETurnState.idle);
	const nextPlayer = game.getPlayerByPosition({playerId:player.id, isNext:true});
	game.changeTurn(nextPlayer.id)
};
