import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find, map} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCards} from '_integration/helpers';
import {ENotification} from 'shared/enum/notifications';
import {Simulate} from 'react-dom/test-utils';
import play = Simulate.play;
import {testPlayerAction} from '_integration/validators';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('whiskey test',  () => {

	it('whiskey card', () => {
		const [gameServer, game, offensePlayer, nextPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.whiskey));
		expect(offensePlayer.hand[0].id).toBe(EEventID.whiskey);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let whiskey = offensePlayer.hand[0];

		expect(whiskey).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: whiskey.uniqueId,
			actionType: EPlayerActionType.cardAct
		});



		//Игрок показывает все карты всем
		expect(nextPlayer.socket.spy.mock.calls).toContainEqual(
			expect.arrayContaining(
				[
					'notification',
					expect.objectContaining({
						type: ENotification.okayCard,
						cards: expect.arrayContaining(
							map(offensePlayer.hand, (card) => expect.objectContaining({id: card.id}))
						)
					})
				]
			)
		);


		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		expect(checkAllDeckCards(game, false)).toBe(true);

	});


});
