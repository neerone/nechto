import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find, map} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {getMissNextPlayer} from 'server/helpers/cardActions/defense/miss';


describe('miss test',  () => {

	it('miss card', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.miss));
		expect(defensePlayer.hand[0].id).toBe(EEventID.miss);

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
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: analysis.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(offensePlayer.hand, {uniqueId: analysis.uniqueId});
		expect(analysis).toBe(undefined);
		let missCard = find(defensePlayer.hand, {id: EEventID.miss});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			cardUniqueId: missCard.uniqueId,
			actionType: EPlayerActionType.cardAct
		});


		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: missCard.uniqueId }));
		//expect(offensePlayer.hand).toContainEqual(expect.objectContaining({uniqueId: analysis.uniqueId}));

		const nextDefensePlayer = getMissNextPlayer(game, defensePlayer);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(nextDefensePlayer.turnState).toBe(ETurnState.inDefenseTrade);

		//Игрок дал одну карту на обмен и теперь у него 3 карты
		expect(offensePlayer.hand.length).toBe(3);
		//т.к теперь ходит нирон, у него 5 карт  на руке
		expect(defensePlayer.hand.length).toBe(4);
		expect(nextDefensePlayer.hand.length).toBe(4);

		/* начинаем трейд следующего игрока */
		const firstCard = nextDefensePlayer.hand[0];
		expect(firstCard).not.toBe(undefined);

		testPlayerAction(gameServer, game, {
			player:nextDefensePlayer,
			cardUniqueId: firstCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});
		expect(offensePlayer.hand.length).toBe(4);
		//expect(defensePlayer.hand.length).toBe(4);
		expect(nextDefensePlayer.hand.length).toBe(4);

		const nextTurnPlayer = game.getPlayerByPosition({playerId: offensePlayer.id, isNext:true});
		expect(nextTurnPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextTurnPlayer.hand.length).toBe(5);
		expect(nextTurnPlayer).toBe(defensePlayer)


		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
