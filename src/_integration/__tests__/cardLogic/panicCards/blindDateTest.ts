import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find, map} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {Simulate} from 'react-dom/test-utils';
import play = Simulate.play;
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('blindDate test',  () => {

	it('blindDate card', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.whiskey));
		expect(offensePlayer.hand[0].id).toBe(EEventID.whiskey);

		game.deck.splice(0,1, getPanic(EPanicID.blindDate));
		game.changeTurn(offensePlayer.id);


		const whiskey = offensePlayer.hand[0];
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: whiskey.uniqueId,
			actionType: EPlayerActionType.cardSelect
		});

		const nextPlayer = offensePlayer.getNextPlayer();
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextPlayer.hand.length).toBe(5);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
