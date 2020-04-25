import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {each} from 'lodash';
import {ETurnState} from 'shared/enum/player';

export const oldRopesAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Паника: старые веревки. Все карты "Карантин" сбрасываются');
	each(game.players, (pl) => {
		pl.quarantine = 0;
	})
	player.changeTurnState(ETurnState.inOffenseTrade);
};
