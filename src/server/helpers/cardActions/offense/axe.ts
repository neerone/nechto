import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';


export const axeAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.axePersonSelect,
		playerId: player.id,
		cardUniqueId: card.uniqueId
	};


	player.changeTurnState(ETurnState.inCardActionProgress);

	const axeTargets = player.getAxeTargets();

    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: axeTargets,
		text: 'Выбри на что хочешь применить топор'
      },
    }));
};

export const axeSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.axePersonSelect) {
		throw new Error('Выбор подозрения произошел без контекста axePersonSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	const selectedPlayer = game.players[selectedPlayerId];
	game.turnContext = null;
	if (!selectedPlayer) return;
	if (selectedPlayer.state === EPlayerState.door) {
		game.playersList = game.playersList.filter((playerId) => {
			return playerId !== selectedPlayer.id
		})
	}

	selectedPlayer.quarantine = 0;
	selectedPlayer.quarantineFresh = false;

	game.addLog(`Игрок ${player.nickname} играет карту "Топор" на ${selectedPlayer.nickname}`, EGameLogType.card);
	game.addCardEffect({cardId: EEventID.axe, player, target: selectedPlayer});
	player.changeTurnState(ETurnState.inOffenseTrade)
};
