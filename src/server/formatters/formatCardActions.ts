import {filter, each} from 'lodash';
import {ICardEventMenuItem} from 'shared/interfaces/cardMenu';
import {ETurnState} from 'shared/enum/player';
import {EEventID, EEventType} from 'shared/enum/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Game} from 'server/models/Game';
import {ICardEvent} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';
import {ETurnContextType} from 'shared/enum/turnContextType';

const infectsCount = (player: Player) => {
	let infects = 0
	each(player.hand, card => {
		if (card.id === EEventID.infect) {
			infects = infects+1
		}
	})
	return  infects;
	//const infects = filter(player.hand, { id: EEventID.infect});
	//return infects.length;
};

const getTargetPlayer = (game:Game, player: Player): Player | null => {
	//Пассивный ход
	if (player.turnState === ETurnState.idle
		|| player.turnState === ETurnState.inCardAction
		|| player.turnState === ETurnState.inCardActionProgress
	) return null;

	const context = game.turnContext;
	if (!context) return null;
	switch (context.type) {
		case ETurnContextType.trade:
		case ETurnContextType.burn:
		case ETurnContextType.positionswap:
			if (context.defensePlayer === player) return context.offensePlayer;
			if (context.offensePlayer === player) return context.defensePlayer;
	}
	return null;
};

export const getCardActions = (game: Game, player: Player, card: ICardEvent): ICardEventMenuItem[] => {
	let actions : ICardEventMenuItem[] = [];
	if (!player.isAlive()) return [];
	if (!card.eventType) return actions;
	if (card.id === EEventID.thing) return [];
	if (!game.gameInProcess) return [];

	const isCurrentPlayerInjured = player.isInjured;
	const isCurrentPlayerThing = player.isThing;

	const targetPlayer = getTargetPlayer(game, player);

	const isTargetPlayerThing = targetPlayer && targetPlayer.isThing;

	//у инжуры дроп только если не заражен ИЛИ карт заражения больше 1 или игрок нечто
	const canDiscardInjure = !isCurrentPlayerInjured || infectsCount(player) > 1 || isCurrentPlayerThing;
	const canTradeInjure = isCurrentPlayerThing || (isCurrentPlayerInjured && isTargetPlayerThing);



	switch (player.turnState) {
		case ETurnState.idle:
			return actions;
		case ETurnState.inCardAction:
			if (card.id === EEventID.infect && !canDiscardInjure) {
				return [];
			}

			const targets = player.getCardTargets(card);
			const isNonTargetCard = player.isCardNonTarget(card);
			if (targets.length > 0 || isNonTargetCard) {
				actions.push({ menuType: EPlayerActionType.cardAct});
			}

			actions.push({ menuType: EPlayerActionType.cardDiscard});
			return actions;
		case ETurnState.inOffenseTrade:
			if (card.eventType === EEventType.infect) {
				if (canTradeInjure)	actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			return actions;
		case ETurnState.inDefenseTrade:
			if (card.id === EEventID.infect) {
				if (canTradeInjure) {
					actions.push({ menuType: EPlayerActionType.cardTrade});
				}
				return actions;
			}
			if (card.eventType === EEventType.antiTrade) {
				actions.push({ menuType: EPlayerActionType.cardAct});
				actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			break;
	}
	return actions;
};
