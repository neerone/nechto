import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {each} from 'lodash';
import {debugLog} from 'server/helpers/util';

export const seductionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	game.turnContext = {
		type: ETurnContextType.seduction,
		offensePlayer: player,
		defensePlayer: null
	};
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться картами'
      },
    }));
    game.addLog(`Игрок ${player.nickname} играет Соблазн`);
};

export const seductionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	const playerToTrade = game.players[selectedPlayerId];
	if (player === playerToTrade) {
		game.turnContext = null;
		game.endTurn(player.id);
		return;
	}
	game.turnContext = {
		type: ETurnContextType.trade,
		offensePlayer: player,
		defensePlayer: playerToTrade,
		offenseCard: null,
		defenseCard: null,
	};
    game.addLog(`Игрок ${player.nickname} предлагает обмен картами ${playerToTrade.nickname}`);
	//playerToTrade.changeTurnState(ETurnState.inDefenseTrade);
	player.changeTurnState(ETurnState.inOffenseTrade)
};

//export const seductionTradeFinish = ({game} : {game: Game}) => {
//	if (game.turnContext.type !== ETurnContextType.trade) {
//		throw new Error('Завершение обмена seduction');
//	}
//	debugLog('SEDUCTION FINISH');
//	each(game.players, (player: Player) => {
//		player.changeTurnState(ETurnState.idle);
//	});
//	const offensePlayer = game.turnContext.offensePlayer;
//	const defensePlayer = game.turnContext.defensePlayer;
//	game.turnContext = null;
//	defensePlayer.changeTurnState(ETurnState.idle)
//  game.endTurn(offensePlayer.id);
//};
