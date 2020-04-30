import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('tenacity test',  () => {

	it('tenacity card', () => {
		const [gameServer, game, offensePlayer, nextPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.tenacity));
		expect(offensePlayer.hand[0].id).toBe(EEventID.tenacity);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let tenacity = offensePlayer.hand[0];

		expect(tenacity).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: tenacity.uniqueId,
			actionType: EPlayerActionType.cardAct
		});


		const {cards: [firstTenacityCard]} = offensePlayer.currentAction as any;
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: firstTenacityCard.uniqueId,
			actionType: EPlayerActionType.cardSelect
		});

		expect(offensePlayer.hand).toContainEqual(
			expect.objectContaining({uniqueId: firstTenacityCard.uniqueId})
		)
		expect(offensePlayer.hand).not.toContainEqual(
			expect.objectContaining({uniqueId: tenacity.uniqueId})
		)


		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(offensePlayer.hand.length).toBe(5);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
