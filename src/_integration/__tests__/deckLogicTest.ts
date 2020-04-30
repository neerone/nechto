import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnState} from 'shared/enum/player';
import {createMockGameServer} from '_integration/createGameServer';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';

let counter = 0;

const testPlayerLogic = (gameServer, game, player) => {
	let randomCard = player.getRandomPlayableCard();
	if (player.turnState === ETurnState.inDefenseTrade) {
		testPlayerAction(gameServer, game, {
			player:player,
			cardUniqueId: randomCard.uniqueId,
			actionType: EPlayerActionType.cardTrade
		});
	}
	randomCard = player.getRandomPlayableCard();
	testPlayerAction(gameServer, game, {
		player:player,
		cardUniqueId: randomCard.uniqueId,
		actionType: EPlayerActionType.cardDiscard
	});

	//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	randomCard = player.getRandomPlayableCard();
	testPlayerAction(gameServer, game, {
		player:player,
		cardUniqueId: randomCard.uniqueId,
		actionType: EPlayerActionType.cardTrade
	});

	counter ++;
	console.log('COUNTER=================', counter)
	if (counter === 70) return;
	const nextPlayer = player.getNextPlayer();
	return testPlayerLogic(gameServer, game, nextPlayer)
}

describe('trade logic',  () => {
	it('deck should be consistent', () => {
		const [gameServer, game, APlayer, BPlayer, CPlayer, DPlayer, EPlayer] = createMockGameServer(true);
		APlayer.hand.splice(0,1);
		game.changeTurn(APlayer.id);
		testPlayerLogic(gameServer, game, APlayer)
	});

});
