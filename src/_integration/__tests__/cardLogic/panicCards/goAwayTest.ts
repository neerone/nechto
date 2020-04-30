import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition, printPlayersStatuses} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('goAway test',  () => {

	it('goAway card', () => {
		const [gameServer, game, offensePlayer, APlayer, defensePlayer, CPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		APlayer.quarantine = 3;
		game.deck.splice(0,1, getPanic(EPanicID.goAway));
		game.changeTurn(offensePlayer.id);

		//У Offense player нет возможности поменяться со всеми кроме карантина

		expect(offensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.playerSelect,
				playersToSelect: expect.arrayContaining([
					defensePlayer.id, CPlayer.id
				])
			})
		);

		expect(offensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.playerSelect,
				playersToSelect: expect.not.arrayContaining([
					APlayer.id
				])
			})
		);
		expect(offensePlayer.turnState).toBe(ETurnState.inCardActionProgress);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		//Должны поменяться местами
		expect(initialDefensePosition).toBe(afterOffensePosition);
		expect(initialOffensePosition).toBe(afterDefensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(defensePlayer.turnState).toBe(ETurnState.idle);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
