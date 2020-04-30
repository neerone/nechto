import {Game} from 'server/models/Game';
import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {find, findLast} from 'lodash';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ENotificationAction} from 'shared/enum/notifications';
import {debugLog} from 'server/helpers/util';

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

export const isPlayerCanDiscardCard = (game: Game, player: Player, cardUniqueId: string) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}
	if (player.currentAction.type !== ENotificationAction.turnCard) return false;

	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardDiscard });
	switch (player.turnState) {
		case ETurnState.inCardAction:
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};


export const isPlayerCanActCard = (game: Game, player: Player, cardUniqueId: string) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}
	if (player.currentAction.type !== ENotificationAction.turnCard && player.currentAction.type !== ENotificationAction.defenseTradeCard) return false;
	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardAct});
	switch (player.turnState) {
		case ETurnState.inCardAction:
		case ETurnState.inDefenseTrade:
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

export const isPlayerCanTradeCard = (game: Game, player: Player, cardUniqueId: string) => {
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
			if (!player.currentAction || (player.currentAction.type !== ENotificationAction.defenseTradeCard
				&& player.currentAction.type !== ENotificationAction.offenseTradeCard)) {
				debugLog('CARD ACTIONS WAS', cardActions, player.nickname, player.turnState, selectedCard.id)
				return false;
			}
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

export const isPlayerCanSelectPlayer = (game, player, selectedPlayerId) => {
	//Проверяем есть ли в игре игрок с таким ID
	const selectedPlayer = find(game.players, {id:selectedPlayerId});
	if (!selectedPlayer) {
		throw new Error(`Игрока с ID ${selectedPlayerId} не существует в игре`)
	}

	const event = player.currentAction;
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.playerSelect) {
		debugLog('CARD ACTIONS WAS', event, player.nickname, player.turnState, selectedPlayerId)
		return false;
	}
	if (!event.playersToSelect.includes(selectedPlayerId)) {
		console.error(`В эвенте нету ID пользователя`, event, selectedPlayerId)
	}
	return event.playersToSelect.includes(selectedPlayerId)
};

export const isPlayerCanSelectCard = (game: Game, player: Player, cardUniqueId: string) => {
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.selectCard) {
		return false;
	}
	const event = player.currentAction;
	const selectedCard = find(event.cards, {uniqueId: cardUniqueId})
	if (!selectedCard) {
		console.error(`В предложенных картах нету ID выбранной`, event, cardUniqueId)
	}
	return !!selectedCard
};

export const isPlayerCanSelectDesicion = (game, player, action) => {
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.actionDecision) {
		return false;
	}
	const event = player.currentAction;
	const selectedAction = find(event.menu, {action});
	if (!selectedAction) {
		console.error(`В предложенных экшнах нету выбранного`, event, action)
	}
	return !!selectedAction
};
