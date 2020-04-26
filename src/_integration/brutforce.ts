import {createMockGameServer} from '_integration/createGameServer';
import {each, find, map, sortBy} from 'lodash';
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
import play = Simulate.play;

let counter = 0;
type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

function getRandomItemFromArray<A extends any[]>(arr: A): ArrayElement<A> {
	if (!arr) return null;
	return shuffle(arr)[0]
}

let getFirstPlayableCardId = (game, player) => {
	const playableCards = map(player.hand, card => {
		return {uniqueId: card.uniqueId, menu: getCardActions(game, player, card)};
	})
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
	console.log(preferredCard)
	const cardActions: ICardEventMenuItem[] = getCardActions(game, player, preferredCard);
	console.log(cardActions)
	const currentAction = getRandomItemFromArray(cardActions);

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
		return gameServer.actionDecision({player, action: randomAction.action});
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
	if (!player.currentAction) return;
	switch (player.currentAction.type) {
		case ENotificationAction.selectCard:
			return botSelectCardLogic(gameServer, player, game);
		case ENotificationAction.offenseTradeCard:
		case ENotificationAction.defenseTradeCard:
			return botTradeCardLogic(gameServer, player, game);
		case ENotificationAction.actionDecision:
			return botActionDecisionLogic(gameServer, player, game);
		case ENotificationAction.playerSelect:
			return botPlayerSelectLogic(gameServer, player, game);
		case ENotificationAction.turnCard:
			return botPlayerTurnCardLogic(gameServer, player, game);
	}
};

const startBrutforce = () => {
	const [gameServer, game] = createBrutforceServer();

	while(true) {
		each(game.playersList, pId => {
			const player = game.players[pId];
			botAct(gameServer, player, game)
		})
	}
}


startBrutforce();

export const a = 1;
