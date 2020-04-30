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


describe('leavemealone test',  () => {

	it('should cancel position swap', () => {

		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0].id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = defensePlayer.getPrevPlayer();
		offensePlayer.hand.splice(0,1, getCard(EEventID.positionswap));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		expect(positionswap).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: positionswap.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: positionswap.uniqueId}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'cancelSwap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		expect(initialDefensePosition).toBe(afterDefensePosition);
		expect(initialOffensePosition).toBe(afterOffensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: leaveMeAlone.uniqueId }));
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: positionswap.uniqueId}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);


	});

	it('should cancel reelFishingRold swap', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0].id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.reelFishingRods));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let reelFishingRods = find(offensePlayer.hand, {id: EEventID.reelFishingRods});

		expect(reelFishingRods).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: reelFishingRods.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: reelFishingRods.uniqueId}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться

		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'cancelSwap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		expect(initialDefensePosition).toBe(afterDefensePosition);
		expect(initialOffensePosition).toBe(afterOffensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: leaveMeAlone.uniqueId }));
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: reelFishingRods.uniqueId}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);


	});

	it('should swap', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0].id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.positionswap));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		expect(positionswap).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: positionswap.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: positionswap.uniqueId}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'swap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		//Должны поменяться местами
		expect(initialDefensePosition).toBe(afterOffensePosition);
		expect(initialOffensePosition).toBe(afterDefensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).toContainEqual(expect.objectContaining({ uniqueId: leaveMeAlone.uniqueId }));
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

});
