import {Game} from 'server/models/Game';
import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {
	isPlayerCanActCard, isPlayerCanDiscardCard,
	isPlayerCanSelectCard, isPlayerCanSelectDesicion,
	isPlayerCanSelectPlayer,
	isPlayerCanTradeCard,
} from 'server/helpers/validators';

interface IActionPayload  {
	player:Player,
	actionType: EPlayerActionType,
	cardUniqueId?: string,
	selectedPlayerId?:string,
	action?: any
}



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
		case EPlayerActionType.actionDecision: {
			if (!payload.action) throw new Error('Произошел вызов экшна без action' + JSON.stringify(payload));
			if (!payload.player) throw new Error('Произошел вызов экшна без player' + JSON.stringify(payload));
			expect(isPlayerCanSelectDesicion(game, player, payload.action)).toBe(true);
			break;
		}
	}

	gameServer.playerAction(payload);
}
