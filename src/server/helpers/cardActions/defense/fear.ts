import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
//
import {ETurnContextType} from 'shared/enum/turnContextType';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const fearAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	const context = game.turnContext;
	if (context.type !== ETurnContextType.trade) {
		throw  new Error('Fear использован вне контекста торговли')
	}
	//player.discardCard(card.uniqueId);
	player.discardCard(card.uniqueId);
	game.addLog(`${player.nickname}: используя карту Страх отказывается от обмена с игроком ${context.offensePlayer.nickname}`);
	game.grabEventCardFromDeck({player});
	const offensePlayer = context.offensePlayer;
	offensePlayer.getCard(getCard(context.offenseCardId));


	player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: [getCard(context.offenseCardId)],
		text: `${offensePlayer.nickname}: я хотел тебе эту дать`,
      },
    }));

    game.notifyAllPlayersExeptPlayer(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: [getCard(EEventID.fear)],
		text: `${player.nickname}: отказывается от обмена`,
      },
    }), player);
	game.endTurn(offensePlayer.id);
};
