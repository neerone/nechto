import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {clone, each, filter} from 'lodash';
import {EGameLogType} from 'shared/enum/gameLogType';

export const youCallThisPartyAct = ({game, player} : {game: Game, player: Player}) => {
	game.playersList = filter(game.playersList, (pId) => {
		const pl = game.players[pId];
		if (!pl) return false;
		pl.quarantine = 0;
		pl.quarantineFresh = false;
		return pl.state === EPlayerState.dummy
	});

	const indexOfCurrentPlayer = game.playersList.indexOf(player.id);
	let newPlayerList = clone(game.playersList);
	let beforeCurrentPlayer = newPlayerList.slice(0, indexOfCurrentPlayer);
	newPlayerList.splice(0, indexOfCurrentPlayer);
	newPlayerList = newPlayerList.concat(beforeCurrentPlayer);


	each(newPlayerList, (pId, index) => {
		if (index % 2 !== 0) {
			//Идем только по нечетным индексам
			const swapA = pId;
			const swapB = newPlayerList[index-1];
			if (swapA && swapB) {
				game.swapPlayers(swapA, swapB)
			}
		}
	})
	game.addLog('И это вы называете вечеринкой? Игроки попарно поменялись местами. Все карантины и двери сброшены.', EGameLogType.panic)
	player.changeTurnState(ETurnState.inOffenseTrade)
};

