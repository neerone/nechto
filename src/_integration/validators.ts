import {Game} from 'server/models/Game';
import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {find, findLast} from 'lodash';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ENotificationAction} from 'shared/enum/notifications';

interface IActionPayload  {
	player:Player,
	actionType: EPlayerActionType,
	cardUniqueId?: string,
	selectedPlayerId?:string,
	actionContext?: any
}

interface IActionDecisionPayload {
	player:Player,
	action:string,
}

const isPlayerCanDiscardCard = (game, player, cardUniqueId) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}
	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardDiscard });
	switch (player.turnState) {
		case ETurnState.inCardAction:
			if (!actAction) {
				console.log('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};


const isPlayerCanActCard = (game, player, cardUniqueId) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}
	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardAct});
	switch (player.turnState) {
		case ETurnState.inCardAction:
		case ETurnState.inDefenseTrade:
			if (!actAction) {
				console.log('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

const isPlayerCanTradeCard = (game, player, cardUniqueId) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}

	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardTrade});
	switch (player.turnState) {
		case ETurnState.inDefenseTrade:
		case ETurnState.inOffenseTrade:
			if (!actAction) {
				console.log('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

const isPlayerCanSelectPlayer = (game, player, selectedPlayerId) => {
	//Проверяем есть ли в игре игрок с таким ID
	const selectedPlayer = find(game.players, {id:selectedPlayerId});
	if (!selectedPlayer) {
		throw new Error(`Игрока с ID ${selectedPlayerId} не существует в игре`)
	}

	const lastSelectPlayerNotification = findLast(player.socket.spy.mock.calls, ([type, event]) => {
		if (type !=='notification') return false;
		if (event.type !== ENotificationAction.playerSelect) return false;
		return true;
	})
	if (!lastSelectPlayerNotification) return false;
	const [type, event] = lastSelectPlayerNotification;
	if (!event.playersToSelect.includes(selectedPlayerId)) {
		console.error(`В эвенте нету ID пользователя`, event, selectedPlayerId)
	}
	return event.playersToSelect.includes(selectedPlayerId)
};

const isPlayerCanSelectCard = (game, player, cardUniqueId) => {
	const lastSelectCardNotification = findLast(player.socket.spy.mock.calls, ([type, event]) => {
		if (type !=='notification') return false;
		if (event.type !== ENotificationAction.selectCard) return false;
		return true;
	})

	if (!lastSelectCardNotification) {
		return false;
	}
	const [type, event] = lastSelectCardNotification;
	const selectedCard = find(event.cards, {uniqueId: cardUniqueId})
	if (!selectedCard) {
		console.error(`В предложенных картах нету ID выбранной`, event, cardUniqueId)
	}
	return !!selectedCard
};

const isPlayerCanSelectDesicion = (game, player, action) => {
	const lastDesicionNotification = findLast(player.socket.spy.mock.calls, ([type, event]) => {
		if (type !=='notification') return false;
		if (event.type !== ENotificationAction.actionDecision) return false;
		return true;
	})

	if (!lastDesicionNotification) {
		return false;
	}
	const [type, event] = lastDesicionNotification;
	const selectedAction = find(event.menu, {action})
	if (!selectedAction) {
		console.error(`В предложенных экшнах нету выбранного`, event, action)
	}
	return !!selectedAction
};

export const testPlayerAction = (gameServer:GameServer, game: Game, payload: IActionPayload) => {
	if (!payload.actionType) throw new Error('Произошел вызов экшна без type' + JSON.stringify(payload));
	if (!payload.player) throw new Error('Произошел вызов экшна без player' + JSON.stringify(payload));

	const {player, actionType} = payload;

	switch (actionType) {
		case EPlayerActionType.cardTrade: {
			expect(isPlayerCanTradeCard(game, player, payload.cardUniqueId)).toBe(true)
			break;
		}
		case EPlayerActionType.cardAct: {
			expect(isPlayerCanActCard(game, player, payload.cardUniqueId)).toBe(true);
			break;
		}
		case EPlayerActionType.cardDiscard: {
			expect(isPlayerCanDiscardCard(game, player, payload.cardUniqueId)).toBe(true);
			break;
		}
		case EPlayerActionType.playerSelect: {
			expect(isPlayerCanSelectPlayer(game, player, payload.selectedPlayerId)).toBe(true);
			break;
		}
		case EPlayerActionType.cardSelect: {
			expect(isPlayerCanSelectCard(game, player, payload.cardUniqueId)).toBe(true);
			break;
		}
	}

	gameServer.playerAction(payload);
}

export const testPlayerActionDecision = (gameServer:GameServer, game: Game, payload: IActionDecisionPayload) => {
	if (!payload.action) throw new Error('Произошел вызов экшна без action' + JSON.stringify(payload));
	if (!payload.player) throw new Error('Произошел вызов экшна без player' + JSON.stringify(payload));

	const {player, action} = payload;
	expect(isPlayerCanSelectDesicion(game, player, payload.action)).toBe(true);
	gameServer.actionDecision(payload);
}

