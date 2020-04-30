import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {each, filter, find, remove} from 'lodash';

import {EEventID} from 'shared/enum/cards';

export const getNextChainReactionPlayer = ({game, currentPlayer}:  {game: Game, currentPlayer: Player}) => {
	const nextPlayer = currentPlayer.getNextAlivePlayer();
	//if (nextPlayer.state === EPlayerState.door) return getNextChainReactionPlayer({game, currentPlayer: nextPlayer});
	if (nextPlayer === currentPlayer) return null;
	return nextPlayer;
}

const getPlayersCount = ({game}: {game:Game}) => {
	return filter(game.playersList, (pId) => {
		const pl = game.players[pId];
		return pl.state === EPlayerState.dummy;
	}).length;
}

export const chainReactionAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Цепная реакция! Все игроки меняются картами по кругу, игнорируя карты "карантин" и "заколоченная дверь". Отказаться от обмена нельзя.');
	game.turnContext = {
		type: ETurnContextType.chainReaction,
		playersPick: [],
		startPlayer: player,
	};
	each(game.players, (p => {
		if (p.isAlive()) {
			 p.changeTurnState(ETurnState.inOffenseTrade)
		}
	}));
};


export const chainReactionTrade = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.chainReaction) {
		throw new Error("Смена карты без контекста chainReaction")
	}
	const cardToTrade = find(player.hand, {uniqueId:cardUniqueId});
	//discardCard({player, cardUniqueId, game});
	remove(player.hand, (card) => { return card.uniqueId === cardUniqueId});
	game.turnContext.playersPick.push({player, card:cardToTrade});
	player.changeTurnState(ETurnState.idle);

	if (game.turnContext.playersPick.length === getPlayersCount({game})) {
		each(game.turnContext.playersPick, ({player: pickPlayer, card: pickCard}) => {
			const nextPlayer = getNextChainReactionPlayer({game, currentPlayer: pickPlayer});
			if (!nextPlayer) return;
			nextPlayer.getCard(pickCard);
			if (pickCard.id=== EEventID.infect) {
				game.infectPlayer(nextPlayer.id);
			}
		})
		game.endTurn(game.turnContext.startPlayer.id)
	}


};
