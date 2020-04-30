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


describe('antifire test',  () => {

	it('antifire cancel burn', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.noFire));
		expect(defensePlayer.hand[0].id).toBe(EEventID.noFire);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.flamethrower));

		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let flamethrower = find(offensePlayer.hand, {id: EEventID.flamethrower});

		expect(flamethrower).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: flamethrower.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: flamethrower.uniqueId}));

		let noFire = find(defensePlayer.hand, {id: EEventID.noFire});
		expect(offensePlayer.turnState).toBe(ETurnState.inCardActionProgress);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'burn'}),
					expect.objectContaining({action:'noFire'}),
				])
			})
		);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'noFire',
		});

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: noFire.uniqueId }));
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: flamethrower.uniqueId}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);


	});

	it('antifire burn', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		defensePlayer.isThing = false;
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.noFire));
		expect(defensePlayer.hand[0].id).toBe(EEventID.noFire);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.flamethrower));

		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let flamethrower = find(offensePlayer.hand, {id: EEventID.flamethrower});

		expect(flamethrower).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: flamethrower.uniqueId,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: flamethrower.uniqueId}));

		let noFire = find(defensePlayer.hand, {id: EEventID.noFire});
		expect(offensePlayer.turnState).toBe(ETurnState.inCardActionProgress);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'burn'}),
					expect.objectContaining({action:'noFire'}),
				])
			})
		);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'burn',
		});

		expect(game.playersList).not.toContain(defensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)


		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: flamethrower.uniqueId}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(0);
		expect(defensePlayer.turnState).toBe(ETurnState.dead);


	});

});
