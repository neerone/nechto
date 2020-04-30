import {each, find, isEqual, map, sortBy} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {GameServer} from 'server/server/GameServer';
import {clearDebugCache, debugCache, debugLog, printDebugCache, shuffle} from 'server/helpers/util';
import {INotificationActionSelectCard} from 'shared/interfaces/notification';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ICardEventMenuItem} from 'shared/interfaces/cardMenu';
import {createBrutforceServer} from '_integration/createBrutforceServer';
import {EPlayerState} from 'shared/enum/player';


type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

function getRandomItemFromArray<A extends any[]>(arr: A): ArrayElement<A> {
	if (!arr) return null;
	return shuffle(arr)[0]
}

let getFirstPlayableCardId = (game, player) => {
	const playableCards = map(player.hand, card => {
		return {uniqueId: card.uniqueId, menu: getCardActions(game, player, card), type: card.id};
	})
	debugLog(player.nickname, playableCards)
	const sortPlayableCards = sortBy(playableCards, ({uniqueId,menu}) => {
		return menu.length
	});
	if (!sortPlayableCards[sortPlayableCards.length - 1]) {
		throw new Error(`Игроку нечем ходить ${player.nickname}`);
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
	debugLog(`${player.nickname}-${player.turnState} торгует ${preferredCard.id} ${preferredCard.uniqueId}`, cardActions, currentAction, game.turnContext && game.turnContext.type, `players count: ${game.playersList.map(pId=> game.players[pId].nickname)}`)

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
	if (player.state === EPlayerState.door) return false;
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

	let counter = 0;
	let globalStop = false;
	try {
		while(true) {
			const [gameServer, game] = createBrutforceServer();
			let stop = false;
			while(!stop) {
				let actioniterated = false;
				each(game.playersList, pId => {
					const player = game.players[pId];
					try {
						const iterated = botAct(gameServer, player, game)
						if (!actioniterated) actioniterated = iterated;
					} catch(e) {
						//clearDebugCache();
						globalStop = true;
						printBruteforceReport(counter, game);
						throw e;
					}
				})

				if (!actioniterated) {
					const lastLog = game.gameLog[game.gameLog.length-1];
					if (lastLog !== 'Нечто победило' && lastLog !== 'Нечто проиграло') {
						printBruteforceReport(counter, game);
						stop = true;
						globalStop = true;
						return;
					}

					clearDebugCache();
					stop = true;
					counter++;
					console.log(`PLAYERS INFO over ${counter} iterations - ${game.gameLog[game.gameLog.length-1]}`)
					//printBruteforceReport(counter, game);
				}
			}
		}
	} catch(e) {
		throw e
	}


}

const printBruteforceReport = (counter, game:Game) => {
	const lastLog = game.gameLog[game.gameLog.length-1];
	printDebugCache();
	console.log(`PLAYERS INFO over ${counter} iterations - ${lastLog}`, lastLog === 'Нечто победило', lastLog === 'Нечто проиграло')
	each(game.playersList, pId => {
		const player = game.players[pId];
		console.log(`
			PLAYER:  ${player.nickname} ${player.turnState.toUpperCase()} injured: ${player.isInjured} thing: ${player.isThing}  quarantine: ${player.quarantine} 
			HAND`, player.hand && player.hand.map(c => c ? c.id : 'НЕ НАЙДЕНО'));
	})
	//console.log(lastLog, lastLog ==='Нечто победило', lastLog === 'Нечто проиграло')
	//if (lastLog === 'Нечто победило' || lastLog === 'Нечто проиграло') {
//
	//} else {
	//
	//	throw new Error('Unexpected game end');
	//}
};

startBrutforce();

export const a = 1;
