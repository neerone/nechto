import {Game} from 'server/models/Game';
import {clone, concat, difference, each, filter, reduce} from 'lodash';
import {fullDeckObject, getCard, handCardsCount} from 'shared/constant/cards';
import {ICardAny} from 'shared/interfaces/cards';
import {ECardType} from 'shared/enum/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {Player} from 'server/models/Player';
import {initialDeck} from 'server/helpers/gameStarter';
import {debugLog} from 'server/helpers/util';

export const checkAllDeckCards = (game: Game, withPanics = true) => {

	const activePlayers = filter(game.players, p => p.state !== EPlayerState.door)

	const playersCount = Object.keys(activePlayers).length;

	const cardsOnHands = reduce(game.players, (acc, player) => {
		if (player.state === EPlayerState.door) return acc;
		return concat(acc, player.hand);
	}, []);

	let comparingDeck = clone(cardsOnHands);

	comparingDeck = concat([], clone(comparingDeck), clone(game.deck), clone(game.discardedDeck));

	if (comparingDeck.length !== initialDeck.length) {
		debugLog(`CARDS: ${comparingDeck.length}, BUT SHOULD BE: ${initialDeck.length}`, ' players ', playersCount)
		let diff = difference(comparingDeck, initialDeck);
		if (diff.length === 0) {
			diff = difference(initialDeck, comparingDeck);
		}
		//debugLog(comparingDeck, initialDeck);
		debugLog('DECK DIFFERENCE', diff)

		//each(diff, (diffCard) => {
		//	const foundCards =  initialDeck.filter(c => c.id === diffCard.id);
		//	debugLog('FUUNDED SIMILAR CARDS', foundCards)
		//})

		throw new Error('Incorrect cards')
	} else {
		debugLog('CARDS IS FINE', initialDeck.length, ' players ', playersCount)
	}

	each(activePlayers, pl => {
		const playerHandLength = pl.hand.length;
		if (playerHandLength > handCardsCount && pl.turnState !== ETurnState.inCardAction && pl.turnState !== ETurnState.inCardActionProgress) {
			debugLog(`Аномальное количество карт у игрока ${pl.nickname} (${pl.turnState}) - ${playerHandLength} `, pl.hand);
			throw new Error('Player hand anomaly')
		}

	})

	return comparingDeck.length !== initialDeck.length

};

export const checkAllDeckCardsTestEdition = (game: Game, withPanics = true) => {

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

	const cardsShouldBe = filteredDeck.length+1;

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
		console.error(`CARDS: ${fullCardsLength}, BUT SHOULD BE: ${cardsShouldBe}`, ' players ', playersCount)
		throw new Error('Incorrect cards')
	} else {
		debugLog('CARDS IS FINE', cardsShouldBe, ' players ', playersCount)
	}
	return cardsShouldBe === fullCardsLength;
};


export const printPlayersStatuses = game => {
	each(game.players, pl => {
		debugLog(pl.nickname, pl.turnState);
	})
}


export const printNotifications = player => {
	each(player.socket.spy.mock.calls, ([type, event]) => {
		if (type !== 'notification') return;
		debugLog(event);
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
