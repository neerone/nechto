import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('suspicion test',  () => {

	it('suspicion card', () => {
		const [gameServer, game, offensePlayer, nextPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.suspicion));
		expect(offensePlayer.hand[0].id).toBe(EEventID.suspicion);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let suspicion = offensePlayer.hand[0];

		expect(suspicion).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: suspicion.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: nextPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});


		const suspicionNotification = find(offensePlayer.socket.spy.mock.calls, ([type, event]) => {
			if (type !== 'notification') return false;
			if (event.type !== ENotificationAction.okayCard) return false;
			const {cards} = event;
			if (cards) return true;
			return false;
		})

		expect(suspicionNotification).not.toBe(undefined);

		const [_, {cards: [suspictedCard]}] = suspicionNotification

		expect(suspictedCard).not.toBe(undefined);

		expect(nextPlayer.hand).toContainEqual(
			expect.objectContaining({
				uniqueId: suspictedCard.uniqueId
			})
		);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
