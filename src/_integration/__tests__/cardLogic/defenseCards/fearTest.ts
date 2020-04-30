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


describe('fear test',  () => {

	it('fear card', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.fear));
		expect(defensePlayer.hand[0].id).toBe(EEventID.fear);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.barricade));

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let barricade = find(offensePlayer.hand, {id: EEventID.barricade});

		expect(barricade).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: barricade.uniqueId,
			actionType: EPlayerActionType.cardDiscard
		});


		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		let analysis = find(offensePlayer.hand, {id: EEventID.analysis});
		const analysisId = analysis.uniqueId;
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: analysis.uniqueId,
			selectedPlayerId:defensePlayer.id,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(offensePlayer.hand, {uniqueId: analysis.uniqueId});
		expect(analysis).toBe(undefined);
		let neeronesFear = find(defensePlayer.hand, {id: EEventID.fear});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			cardUniqueId: neeronesFear.uniqueId,
			selectedPlayerId:offensePlayer.id,
			actionType: EPlayerActionType.cardAct
		});

		//Игрок показывает карту нирону
		expectOkayCard(defensePlayer, expect.arrayContaining([
			expect.objectContaining({id: EEventID.analysis})
		]))


		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: neeronesFear.uniqueId }));
		//У игрока должна быть старая карта анализа
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({uniqueId: analysisId}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: EEventID.analysis}));

		expect(defensePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		//т.к теперь ходит нирон, у него 5 карт  на руке
		expect(defensePlayer.hand.length).toBe(5);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
