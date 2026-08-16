import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {uniqueId} from 'lodash';
import {ICardEvent} from 'shared/interfaces/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';
import {cardLogName} from 'shared/constant/cardNames';

export const barricadeAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.barricadePersonSelect,
		playerId: player.id,
		cardUniqueId: card.uniqueId,
	};

	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери между кем ты хочешь поставить дверь'
      },
    }));
};

export const barricadeSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.barricadePersonSelect) {
		throw new Error('Смена места произошла без контекста zakolochennayaDverPersonSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	game.turnContext = null;
	const doorPlayer = new Player({socket: null, playerState: EPlayerState.door});
	doorPlayer.game = game;
	doorPlayer.id = uniqueId('dver_');
	doorPlayer.nickname = 'Дверь';
	game.players[doorPlayer.id]= doorPlayer;



	const currentPlayerIndex = game.playersList.indexOf(player.id);
	const selectedPlayerIndex = game.playersList.indexOf(selectedPlayerId);
	const lastIndex = game.playersList.length - 1;

	//Если игрок первый или последний, а его цель наборот - просто аншифтим дверь в массив
	if ((currentPlayerIndex === lastIndex && selectedPlayerIndex === 0) || (currentPlayerIndex === 0 && selectedPlayerIndex === lastIndex)) {
		game.playersList.unshift(doorPlayer.id);
	} else {
		if (currentPlayerIndex > selectedPlayerIndex) {
			game.playersList.splice(currentPlayerIndex, 0, doorPlayer.id);
		} else {
			game.playersList.splice(selectedPlayerIndex, 0, doorPlayer.id);
		}
	}


	const selectedPlayer = game.players[selectedPlayerId];
	if (!selectedPlayer) return;
	game.addLog(
		`Игрок ${player.nickname} картой ${cardLogName(EEventID.barricade)} забарикадировался от игрока ${selectedPlayer.nickname}`,
		EGameLogType.card,
	);
	game.addCardEffect({cardId: EEventID.barricade, player, target: selectedPlayer});
	player.changeTurnState(ETurnState.inOffenseTrade)
};
