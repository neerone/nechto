import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('quarantine test',  () => {

	it('quarantine card self', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		expect(offensePlayer.hand[0].id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: offensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.quarantine).toBe(3);

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		const nextPlayer = game.getPlayerByPosition({playerId: offensePlayer.id, isNext: true});
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction)
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('quarantine card next', () => {
		const [gameServer, game, offensePlayer, nextPlayer, nextNextPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		expect(offensePlayer.hand[0].id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: nextPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(nextPlayer.quarantine).toBe(3);

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('quarantine card prev', () => {
		const [gameServer, game, offensePlayer, nextPlayer, b, c, prevPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.quarantine));
		expect(offensePlayer.hand[0].id).toBe(EEventID.quarantine);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let quarantine = offensePlayer.hand[0];

		expect(quarantine).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: quarantine.uniqueId,
			actionType: EPlayerActionType.cardAct
		});

		console.log('PREV PLAYER ID', prevPlayer.id)

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: prevPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(prevPlayer.quarantine).toBe(3);

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});
});
