import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import { filter, each, clone } from 'lodash';


describe('youcallthis party test',  () => {

	it('youcallthis party card', () => {
		const [gameServer, game, offensePlayer, door, quarantined, DPlayer, EPlayer] = createMockGameServer();
		door.state = EPlayerState.door;
		quarantined.quarantine = 3;
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.youCallThisParty));
		game.changeTurn(offensePlayer.id);



		//Проверяем убитые двери
		const newPlayerList = filter(game.playersList, pId => {
			const pl = game.players[pId];
			return pl.state === EPlayerState.dummy
		});
		expect(game.playersList).toStrictEqual(newPlayerList);

		//Проверяем отсутствие карантина
		each(game.playersList, pId => {
			const pl = game.players[pId];
			expect(pl.quarantine).toBe(0);
		});



		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade);

		expect(game.playersList).toStrictEqual([quarantined.id, offensePlayer.id, EPlayer.id, DPlayer.id])

		//Так как мы зафейкали дверь мы не можем оценить количество карт
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
