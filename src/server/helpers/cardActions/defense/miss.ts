import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';

import {ETurnContextType} from 'shared/enum/turnContextType';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {ETurnState} from 'shared/enum/player';


export const getMissNextPlayer = (game: Game, currentPlayer: Player) => {
	if (game.turnContext.type !== ETurnContextType.trade) return null;
	const offensePlayer = game.turnContext.offensePlayer;
	const nextPlayer = currentPlayer.getNextAlivePlayer();
	if (nextPlayer === offensePlayer) return null;
	return nextPlayer
}

export const missAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (game.turnContext.type !== ETurnContextType.trade) {
		throw  new Error('Fear использован вне контекста торговли')
	}
	const context = game.turnContext;
	player.discardCard(card.uniqueId);
	const nextPlayer = getMissNextPlayer(game, player)
	const offensePlayer = game.turnContext.offensePlayer;
	if (nextPlayer === null) {
		//const offenseCard = game.turnContext.offenseCard;
		offensePlayer.interruptTrade();
		//offensePlayer.getCard(offenseCard)
		//game.endTurn(offensePlayer.id);

		game.addLog(`Игрок ${player.nickname} использовал карту "мимо", но т.к. целью стал игрок ${offensePlayer.nickname} ничего не происходит и ход передается дальше.`);
		game.grabEventCardFromDeck({player});

		return
	}
	game.addLog(`${player.nickname} использует карту "Мимо" и отказывается от обмена с игроком ${context.offensePlayer.nickname}. Вместо него меняется ${nextPlayer.nickname}`);
	game.grabEventCardFromDeck({player});
	player.changeTurnState(ETurnState.idle);


	nextPlayer.changeTurnState(ETurnState.inDefenseTrade);
	if (!nextPlayer.isAlive()) {
		game.addLog(`Мимо прерывается, т.к цель ${nextPlayer.nickname} не живой`);
		offensePlayer.interruptTrade();
		return
	}
	//game.addLog('Ошибка here')
	//game.turnContext.defensePlayer = nextPlayer;



    game.notifyAllPlayersExeptPlayer(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: [getCard(EEventID.miss)],
		text: `${player.nickname}: отказывается от обмена и теперь ходит игрок ${nextPlayer.nickname}`,
      },
    }), player);
};
