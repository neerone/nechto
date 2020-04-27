import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';


export const suspicionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.suspicionPersonSelect,
		playerId: player.id,
	};

	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбри на кого хочешь применить подозрение'
      },
    }));
};

export const suspicionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.suspicionPersonSelect) {
		throw new Error('Выбор подозрения произошел без контекста suspicionPersonSelect');
	}
	const playerToView= game.players[selectedPlayerId];
	const cardToView = playerToView.getRandomCard();
	game.turnContext = null;
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
		text: `Ты подсмотрел у игрока ${playerToView.nickname} эту карту`,
		cards: [cardToView]
      },
    }));
	game.addLog(`Игрок ${player.nickname} играет карту "Подозрение"`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
