import {each, find, map, sortBy, isEqual} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {GameServer} from 'server/server/GameServer';
import {shuffle} from 'server/helpers/util';
import {INotificationActionSelectCard} from 'shared/interfaces/notification';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ICardEventMenuItem} from 'shared/interfaces/cardMenu';
import {createBrutforceServer} from '_integration/createBrutforceServer';
import {Simulate} from 'react-dom/test-utils';

let counter = 0;
type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

function getRandomItemFromArray<A extends any[]>(arr: A): ArrayElement<A> {
	if (!arr) return null;
	return shuffle(arr)[0]
}

let getFirstPlayableCardId = (game, player) => {
	const playableCards = map(player.hand, card => {
		return {uniqueId: card.uniqueId, menu: getCardActions(game, player, card), type: card.id};
	})
	console.log(player.nickname, playableCards)
	const sortPlayableCards = sortBy(playableCards, ({uniqueId,menu}) => {
		return menu.length
	});
	if (!sortPlayableCards[sortPlayableCards.length - 1]) {
		throw new Error('Игроку нечем ходить');
	}
	const preferredCard = find(player.hand, {uniqueId: sortPlayableCards[sortPlayableCards.length - 1].uniqueId})
	return preferredCard;
}


/*
*
*
* BOT LOGIC
*
* */

let lastAction = null;
let actionCounter = 0;

const checkLastAction = (player, actions) => {
	if (isEqual(lastAction, [player, actions])) {
		if (actionCounter > 10) {
			throw new Error('TEST CYCLE LOOP');
		}
		actionCounter++;
		return;
	}
	actionCounter =0;
	lastAction = [player, actions];
}

const botSelectCardLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const action = player.currentAction as INotificationActionSelectCard;
	const cardUniqueId = getRandomItemFromArray(action.cards).uniqueId;
	gameServer.playerAction({
		player,
		actionType: EPlayerActionType.cardSelect,
		cardUniqueId
	});
};

const botTradeCardLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const preferredCard = getFirstPlayableCardId(game, player);
	const cardActions: ICardEventMenuItem[] = getCardActions(game, player, preferredCard);
	const currentAction = getRandomItemFromArray(cardActions);

	checkLastAction(player, cardActions);
	console.log(`${player.nickname}-${player.turnState} торгует ` + preferredCard.id + ' ' + preferredCard.uniqueId, cardActions, currentAction, game.turnContext && game.turnContext.type, `players count: ${JSON.stringify(game.playersList)}`)

	return gameServer.playerAction({
		player,
		actionType: currentAction.menuType,
		cardUniqueId: preferredCard.uniqueId,
	});
};

const botActionDecisionLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const action = player.currentAction;
	if (action.type === ENotificationAction.actionDecision) {
		const menu = action.menu;
		const randomAction = getRandomItemFromArray(menu);
		return gameServer.playerAction({actionType: EPlayerActionType.actionDecision, player, action: randomAction.action});
	}
};

const botPlayerSelectLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const action = player.currentAction;
	if (action.type === ENotificationAction.playerSelect) {
		const playersToSelect = action.playersToSelect;
		return gameServer.playerAction({
			player,
			actionType: EPlayerActionType.playerSelect,
			selectedPlayerId: getRandomItemFromArray(playersToSelect),
		});
	}
};

const botPlayerTurnCardLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const preferredCard = getFirstPlayableCardId(game, player);
	const cardActions: ICardEventMenuItem[] = getCardActions(game, player, preferredCard);
	const currentAction = getRandomItemFromArray(cardActions);

	return gameServer.playerAction({
		player,
		actionType: currentAction.menuType,
		cardUniqueId: preferredCard.uniqueId,
	});
};

const botAct = (gameServer: GameServer, player: Player, game: Game) => {
	if (!player.currentAction) return false;
	switch (player.currentAction.type) {
		case ENotificationAction.selectCard:
			botSelectCardLogic(gameServer, player, game);
			return true;
		case ENotificationAction.offenseTradeCard:
		case ENotificationAction.defenseTradeCard:
			botTradeCardLogic(gameServer, player, game);
			return true;
		case ENotificationAction.actionDecision:
			botActionDecisionLogic(gameServer, player, game);
			return true;
		case ENotificationAction.playerSelect:
			botPlayerSelectLogic(gameServer, player, game);
			return true;
		case ENotificationAction.turnCard:
			botPlayerTurnCardLogic(gameServer, player, game);
			return true;
	}
	return false;
};

const startBrutforce = () => {
	const [gameServer, game] = createBrutforceServer();

	let stop = false;
	while(!stop) {
		let actioniterated = false;
		each(game.playersList, pId => {
			const player = game.players[pId];
			try {
				const iterated = botAct(gameServer, player, game)
				if (!actioniterated) actioniterated = iterated;
				counter++;
			} catch(e) {
				printBruteforceReport(counter, game);
				throw e;
			}
		})

		if (!actioniterated) {
			stop = true;
			printBruteforceReport(counter, game);
		}
	}
}

const printBruteforceReport = (counter, game:Game) => {
	console.log(`PLAYERS INFO over ${counter} iterations`)
	each(game.playersList, pId => {
		const player = game.players[pId];
		console.log(`
			PLAYER:  ${player.nickname} ${player.turnState.toUpperCase()} injured: ${player.isInjured} thing: ${player.isThing}  quarantine: ${player.quarantine} 
			HAND`, player.hand && player.hand.map(c => c.id));
	})
};

startBrutforce();

export const a = 1;
