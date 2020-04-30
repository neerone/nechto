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


describe('analysis test',  () => {

	it('analysis card', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.lookaround));
		expect(offensePlayer.hand[0].id).toBe(EEventID.lookaround);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let lookaround = offensePlayer.hand[0];

		expect(lookaround).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: lookaround.uniqueId,
			actionType: EPlayerActionType.cardAct
		});

		expect(game.isClockwise).toBe(false);
		const nextPlayer = game.getPlayerByPosition({playerId: offensePlayer.id, isNext:true});
		expect(game.playersList[game.playersList.length -1]).toBe(nextPlayer.id)

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
