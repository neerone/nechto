import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition, expectOkayCard} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('analysis test',  () => {

	it('analysis card', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,4, getCard(EEventID.fear), getCard(EEventID.flamethrower), getCard(EEventID.noFire), getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0].id).toBe(EEventID.fear);
		expect(defensePlayer.hand[1].id).toBe(EEventID.flamethrower);
		expect(defensePlayer.hand[2].id).toBe(EEventID.noFire);
		expect(defensePlayer.hand[3].id).toBe(EEventID.leaveMeAlone);


		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id});
		offensePlayer.hand.splice(0,1, getCard(EEventID.analysis));
		expect(offensePlayer.hand[0].id).toBe(EEventID.analysis);
		
		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let analysis = offensePlayer.hand[0];

		expect(analysis).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: analysis.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});


		//Игрок показывает карты Гене
		expectOkayCard(offensePlayer, expect.arrayContaining([
			expect.objectContaining({id: EEventID.fear}),
			expect.objectContaining({id: EEventID.flamethrower}),
			expect.objectContaining({id: EEventID.noFire}),
			expect.objectContaining({id: EEventID.leaveMeAlone}),
		]))

		//Не должно быть старой картой анализа, но должна быть новая
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: analysis.uniqueId}));

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		expect(defensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		//т.к теперь ходит нирон, у него 5 карт  на руке
		expect(defensePlayer.hand.length).toBe(4);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
