import {Game} from 'server/models/Game';
import {concat, each, reduce, filter} from 'lodash';
import {fullDeckObject, getCard} from 'shared/constant/cards';
import {ICardAny} from 'shared/interfaces/cards';
import {ECardType} from 'shared/enum/cards';
import {EPlayerState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {Player} from 'server/models/Player';

export const checkAllDeckCards = (game: Game, withPanics = true) => {
	const cardsOnHands = reduce(game.players, (acc, player) => {
		if (player.state ===EPlayerState.door) return acc;
		return concat(acc, player.hand);
	}, [])
	const fullCardsLength = cardsOnHands.length + game.deck.length + game.discardedDeck.length;

	const activePlayers = filter(game.players, p => p.state !== EPlayerState.door)

	const playersCount = Object.keys(activePlayers).length;

	const filteredDeck = reduce(fullDeckObject, (acc, card: ICardAny) => {
		each(card.playersCount, (count) => {
			if (count <= playersCount) {
				if (!withPanics && card.type === ECardType.panic) {
				} else {
					acc.push(getCard(card.id))
				}
			}
		});
		return acc
	}, [] as ICardAny[]);

	const cardsShouldBe = filteredDeck.length;

	each(game.discardedDeck, (cId) => {
		if (!cId) {
			throw new Error(cId + ' discarded!');
		}
	});
	each(game.deck, (cId) => {
		if (!cId) {
			throw new Error(cId + 'in the deck!');
		}
	});
	if (cardsShouldBe !== fullCardsLength) {
		console.error(`CARDS: ${fullCardsLength}, BUT SHOULD BE: ${cardsShouldBe}`)
	}
	return cardsShouldBe === fullCardsLength;
};

export const printPlayersStatuses = game => {
	each(game.players, pl => {
		console.log(pl.nickname, pl.turnState);
	})
}


export const printNotifications = player => {
	each(player.socket.spy.mock.calls, ([type, event]) => {
		if (type !== 'notification') return;
		console.log(event);
	})
}


export const expectOkayCard = (player: Player, cards: any, text = null) => {
	let containingObject:any = {};
	if (text) containingObject.text = text;
	if (cards) containingObject.cards = cards;
	expect(player.socket.spy.mock.calls).toContainEqual(
		expect.arrayContaining(['notification', expect.objectContaining({
			type: ENotificationAction.okayCard,
			...containingObject
		})])
	);
}
