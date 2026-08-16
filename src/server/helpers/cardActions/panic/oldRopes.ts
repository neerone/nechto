import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {each} from 'lodash';
import {ETurnState} from 'shared/enum/player';
import {EGameLogType} from 'shared/enum/gameLogType';

export const oldRopesAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Паника: старые веревки. Все карты "Карантин" сбрасываются', EGameLogType.panic);
	each(game.players, (pl) => {
		pl.quarantine = 0;
		pl.quarantineFresh = false;
	})
	player.changeTurnState(ETurnState.inOffenseTrade);
};
