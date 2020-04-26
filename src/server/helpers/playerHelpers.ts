import INotificationAction from 'shared/interfaces/notification';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ETurnContextType} from 'shared/enum/turnContextType';

export const playerActionFromNotification = ({game, player, notificationAction}: {game:Game, player:Player, notificationAction: INotificationAction}): INotificationAction => {
	switch (notificationAction.type) {
		case ENotificationAction.actionDecision:
		case ENotificationAction.playerSelect:
		case ENotificationAction.selectCard:
			return notificationAction
		default:
			return null
	}
}

export const processTurnContext = ({player, turnState}: {player:Player, turnState: ETurnState}) => {
	if (turnState === ETurnState.inOffenseTrade) {
		const context = player.game.turnContext;
		let playerToTrade: Player | null =  null;
		if (context && context.type === ETurnContextType.trade && context.defensePlayer) {
			playerToTrade = context.defensePlayer
		} else {
			playerToTrade = player.getNextPlayer();
		}
	    if (playerToTrade.state === EPlayerState.door && !player.game.turnContext) {
			player.game.addLog(`Игрок ${player.nickname} не меняется из-за заколоченной двери`);
			player.game.endTurn(player.id);
			return
	    }
	    if (player.game.turnContext === null) {
		    player.game.turnContext = {
		      type: ETurnContextType.trade,
		      defensePlayer: playerToTrade,
		      offensePlayer: player,
		      offenseCardId: null,
		    };
	    }
	}
}
