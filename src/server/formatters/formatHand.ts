import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ICardEvent} from 'shared/interfaces/cards';
import {getCardActions} from 'server/formatters/formatCardActions';


const formatCard = (game: Game, player: Player) => (card: ICardEvent) => {
	return {...card, actions: getCardActions(game, player, card) }
};

export const formatHand = (game:Game, player:Player) => {
	return map(player.hand, formatCard(game, player));
};
