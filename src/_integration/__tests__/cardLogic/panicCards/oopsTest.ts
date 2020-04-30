import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {checkAllDeckCardsTestEdition, expectOkayCard, printNotifications} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import {EPlayerActionType} from 'shared/enum/playerActions';


describe('oops test',  () => {

	it('oops card', () => {
		const [gameServer, game, offensePlayer, APlayer, defensePlayer, CPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.oops));
		game.changeTurn(offensePlayer.id);

		expectOkayCard(APlayer, expect.arrayContaining(offensePlayer.hand))

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
