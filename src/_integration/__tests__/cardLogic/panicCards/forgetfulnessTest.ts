import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {each, isEqual, find, findLast} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {notifyPlayerDiscardCards} from 'server/helpers/cardActions/panic/forgetfulness';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


const getLastForgetfullnessNotificaitonCards = (offensePlayer) => {
	return offensePlayer.currentAction;
}


describe('forgetfulness test',  () => {

	it('forgetfulness card', () => {
		const [gameServer, game, offensePlayer, door, BPlayer, CPlayer] = createMockGameServer();
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.forgetfulness));
		game.changeTurn(offensePlayer.id);


		let playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		let forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const firstCard = forgetfulnessNotification.cards[0];

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: firstCard.uniqueId,
			actionType: EPlayerActionType.cardSelect
		});

		expect((game.turnContext as any).cards.includes(firstCard.uniqueId)).toBe(true)

		playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const secondCard = forgetfulnessNotification.cards[0];

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: secondCard.uniqueId,
			actionType: EPlayerActionType.cardSelect
		});

		expect((game.turnContext as any).cards.includes(secondCard.uniqueId)).toBe(true)
		playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const thirdCard = forgetfulnessNotification.cards[0];

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: thirdCard.uniqueId,
			actionType: EPlayerActionType.cardSelect
		});

		const discardedCardIds = [firstCard, secondCard, thirdCard].map(c => c.uniqueId);
		each(offensePlayer.hand, (handCard) => {
			expect(discardedCardIds).not.toContain(handCard.uniqueId)
		})

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});



});
