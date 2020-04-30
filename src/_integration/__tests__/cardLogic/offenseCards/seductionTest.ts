import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('seduction test',  () => {

	it('seduction card self', () => {
		const [gameServer, game, offensePlayer, APlayer, BPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.seduction), getCard(EEventID.miss));
		expect(offensePlayer.hand[0].id).toBe(EEventID.seduction);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let seduction = offensePlayer.hand[0];
		let miss = offensePlayer.hand[1];

		expect(seduction).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: seduction.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: BPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			actionType: EPlayerActionType.cardTrade,
			cardUniqueId: miss.uniqueId,
		});

		expect(BPlayer.turnState).toBe(ETurnState.inDefenseTrade);

		const BPlayerCard = BPlayer.getRandomPlayableCard();

		testPlayerAction(gameServer, game, {
			player:BPlayer,
			actionType: EPlayerActionType.cardTrade,
			cardUniqueId: BPlayerCard.uniqueId,
		});

		const nextPlayer = game.getPlayerByPosition({playerId:offensePlayer.id, isNext:true});
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
