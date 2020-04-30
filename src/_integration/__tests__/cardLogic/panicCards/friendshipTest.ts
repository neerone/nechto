import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {find, findLast} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition, printPlayersStatuses} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


const getLastFriendshipNotificaiton = (offensePlayer) => {
	return offensePlayer.currentAction;
/*	const forgetfulnessNotification = findLast(offensePlayer.socket.spy.mock.calls, ([type, event]) => {
		if (type !== 'notification') return false;
		if (event.type !== ENotificationAction.playerSelect) return false;
		const {playersToSelect} = event;
		if (playersToSelect) return true;
		return false;
	})
	return forgetfulnessNotification[1]*/
}

describe('friendship test',  () => {

	it('friendship test', () => {
		const [gameServer, game, offensePlayer, APlayer, BPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.seduction), getCard(EEventID.miss));

		const missCard = offensePlayer.hand[1];
		expect(offensePlayer.hand[0].id).toBe(EEventID.seduction);

		game.deck.splice(0,1, getPanic(EPanicID.friendship));
		game.changeTurn(offensePlayer.id);

		//Проверяем получил ли человек уведомление
		const notification = getLastFriendshipNotificaiton(offensePlayer)
		expect(notification).not.toBe(undefined);

		//Проверяем есть ли контекст seduction
		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext.type).toBe(ETurnContextType.seduction);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: APlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext.type).toBe(ETurnContextType.trade);
		expect((game.turnContext as any).offensePlayer).toBe(offensePlayer);
		expect((game.turnContext as any).defensePlayer).toBe(APlayer);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: missCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(APlayer.turnState).toBe(ETurnState.inDefenseTrade);

		const randomDefenseCard = APlayer.getRandomPlayableCard();
		testPlayerAction(gameServer, game, {
			player:APlayer,
			cardUniqueId: randomDefenseCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});

		expect(offensePlayer.hand).toContainEqual(
			expect.objectContaining({uniqueId: randomDefenseCard.uniqueId})
		)
		expect(APlayer.hand).toContainEqual(
			expect.objectContaining({id: missCard.id})
		)

		//console.log('+=======================')
		//printPlayersStatuses(game)
		const nextPlayer = offensePlayer.getNextPlayer();
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


});
