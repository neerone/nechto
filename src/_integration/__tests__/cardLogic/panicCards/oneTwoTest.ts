import { getPlayerByStep } from 'server/helpers/cardActions/panic/oneTwo';

import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find, map, each, filter} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCardsTestEdition, printPlayersStatuses} from '_integration/helpers';
import {ENotificationAction} from 'shared/enum/notifications';
import {Simulate} from 'react-dom/test-utils';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';



describe('one two test',  () => {

	it('one two card', () => {
		const [gameServer, game, offensePlayer, APlayer, defensePlayer, CPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		APlayer.quarantine = 3;
		game.deck.splice(0,1, getPanic(EPanicID.oneTwo));
		game.changeTurn(offensePlayer.id);


		const left = getPlayerByStep({game, currentPlayer:offensePlayer, isNext: true, step:2});
		const right = getPlayerByStep({game, currentPlayer:offensePlayer, isNext: false, step:2});

		const selectPlayersId = filter([left,right], pl => {
			return pl.quarantine === 0 && pl.id !== offensePlayer.id
		}).map(p=>p.id);


		//У Offense player есть смена мест
		expect(offensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.playerSelect,
				playersToSelect: expect.arrayContaining(selectPlayersId)
			})
		);
		const initialDefensePosition = game.playersList.indexOf(selectPlayersId[0]);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: selectPlayersId[0],
			actionType: EPlayerActionType.playerSelect
		});

		const afterDefensePosition = game.playersList.indexOf(selectPlayersId[0]);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		expect(initialDefensePosition).toBe(afterOffensePosition);
		expect(initialOffensePosition).toBe(afterDefensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)


		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
