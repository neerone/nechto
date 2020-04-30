import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';

describe('axe test',  () => {

	it('axe should break the door', () => {
		const [gameServer, game, defensePlayer, a, b, c, offensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.axe));
		expect(defensePlayer.hand[0].id).toBe(EEventID.axe);

		offensePlayer.hand.splice(0,1, getCard(EEventID.barricade));
		expect(offensePlayer.hand[0].id).toBe(EEventID.barricade);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let barricade = offensePlayer.hand[0];
		expect(barricade).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: barricade.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		//Должна поставиться стена
		const door = offensePlayer.getNextPlayer();
		expect(door.state).toBe(EPlayerState.door);
		//Не должно быть старой картой barricade, но должна быть новая
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));

		//Оффенс игрок не меняется картами потому что дальше дверь
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		//Т.к у defense теперь ход, у него 5 карт
		expect(defensePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(defensePlayer.hand.length).toBe(5);

		let axe = defensePlayer.hand[0];

		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			cardUniqueId: axe.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			selectedPlayerId: door.id,
			actionType: EPlayerActionType.playerSelect
		});

		const prevPlayer = game.getPlayerByPosition({playerId:defensePlayer.id, isNext: false});

		//Предыдущий игрок не должен быть дверью
		expect(prevPlayer.state).not.toBe(EPlayerState.door);


		expect(defensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);


		//т.к теперь ходит нирон, у него 5 карт  на руке
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		console.log("OK2")
	});

	it('axe should break the quarantine', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();

		defensePlayer.hand.splice(0,1);
		const offensePlayer = game.getPlayerByPosition({playerId:defensePlayer.id, isNext:false});


		game.changeTurn(offensePlayer.id);


		offensePlayer.hand.splice(0,1, getCard(EEventID.axe));
		expect(offensePlayer.hand[0].id).toBe(EEventID.axe);



		offensePlayer.quarantine = 3;
		expect(offensePlayer.quarantine).toBe(3);
		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let axe = offensePlayer.hand[0];
		expect(axe).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: axe.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: offensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);
		expect(offensePlayer.quarantine).toBe(0);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		console.log("OK3")
	});

});
