import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {find, map, each, range} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCards} from '_integration/helpers';
import {ENotification} from 'shared/enum/notifications';
import {Simulate} from 'react-dom/test-utils';
import play = Simulate.play;
import {testPlayerAction} from '_integration/validators';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('trade logic',  () => {

	it('should trade the card', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.tenacity), getCard(EEventID.analysis));
		const discardCard = offensePlayer.hand[0];
		const tradeCard = offensePlayer.hand[1];

		game.changeTurn(offensePlayer.id);



		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: discardCard.uniqueId,
			actionType: EPlayerActionType.cardDiscard
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: tradeCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});

		const nextPlayer = offensePlayer.getNextPlayer();
		const randomNextPlayerCard = nextPlayer.getRandomPlayableCard();
		expect(nextPlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:nextPlayer,
			cardUniqueId: randomNextPlayerCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});

		expect(nextPlayer.hand).toContainEqual(expect.objectContaining({id: tradeCard.id}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: randomNextPlayerCard.id}));

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextPlayer.hand.length).toBe(5);


		expect(checkAllDeckCards(game, false)).toBe(true);

	});

	it('should injure by trading injure', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		const nextPlayer = offensePlayer.getNextPlayer();
		offensePlayer.isThing = true;
		offensePlayer.hand.splice(0,1);
		nextPlayer.isInjured = false;
		offensePlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.injure));
		const discardCard = offensePlayer.hand[0];
		const tradeCard = offensePlayer.hand[1];

		game.changeTurn(offensePlayer.id);



		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: discardCard.uniqueId,
			actionType: EPlayerActionType.cardDiscard
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext.type).toBe(ETurnContextType.trade)


		expect(nextPlayer.isInjured).toBe(false);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: tradeCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});

		const randomNextPlayerCard = nextPlayer.getRandomPlayableCard();
		expect(nextPlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:nextPlayer,
			cardUniqueId: randomNextPlayerCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});
		expect(nextPlayer.isInjured).toBe(true);
		expect(nextPlayer.hand).toContainEqual(expect.objectContaining({id: tradeCard.id}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: randomNextPlayerCard.id}));

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextPlayer.hand.length).toBe(5);


		expect(checkAllDeckCards(game, false)).toBe(true);

	});


});

