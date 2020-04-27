import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';


export const analysisAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.analysisPersonSelect,
		playerId: player.id,
	};
	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого хочешь проанализировать'
      },
    }));
};

export const analysisSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.analysisPersonSelect) {
		throw new Error('Карта сыграна без контекста analysisPersonSelect');
	}
	game.turnContext = null;
	const selectedPlayer = game.players[selectedPlayerId];
	game.addLog(`Игрок ${player.nickname} играет карту Анализ на игрока ${selectedPlayer.nickname}`)

	game.addLog(`Игрок ${player.nickname} анализирует ${selectedPlayer.nickname}`);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: selectedPlayer.hand as ICardEvent[],
		text: `${selectedPlayer.nickname}: На, смотри!`,
      },
    }));
	player.changeTurnState(ETurnState.inOffenseTrade)
};
