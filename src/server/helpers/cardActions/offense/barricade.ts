import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {uniqueId} from 'lodash';
import {ICardEvent} from 'shared/interfaces/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';

export const barricadeAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.barricadePersonSelect,
		playerId: player.id,
	};
	player.discardCard(card.uniqueId);
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
	if (game.turnContext.type !== ETurnContextType.barricadePersonSelect) {
		throw new Error('Смена места произошла без контекста zakolochennayaDverPersonSelect');
	}
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
	game.addLog(`Игрок ${player.nickname} забарикадировался от  ${selectedPlayer.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
