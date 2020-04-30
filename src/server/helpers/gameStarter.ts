import {Game} from 'server/models/Game';
import {fullDeckObject, getCard, getPanic, handCardsCount, thingCard} from 'shared/constant/cards';
import {concat, each, find, range, reduce, clone} from 'lodash';
import {ICardAny, ICardEvent} from 'shared/interfaces/cards';
import {shuffle} from 'server/helpers/util';
import * as chroma from 'chroma-js';
import {gameServer} from 'server/server/GameServer';
import {ECardType, EEventID, EPanicID} from 'shared/enum/cards';
import {checkAllDeckCards} from '_integration/helpers';

export let initialDeck = [];

export const gameStarter = (game: Game) => {
	const players = game.players;

	// Получаем все игровые карты

	const playersCount = Object.keys(players).length || 0;
	if (!playersCount) throw new Error("количество игроков равно нулю");

	const filteredDeck = reduce(fullDeckObject, (acc, card: ICardAny) => {
		each(card.playersCount, (count) => {
			if (count <= playersCount) {
				acc.push(getCard(card.id))
			}
		});
		return acc
	}, [] as ICardAny[]);

	const shuffledDeck = shuffle(filteredDeck);

	const [playableCards, otherCards] = reduce(shuffledDeck, ([events, other], card) => {
		if (card.type === ECardType.event && card.id !== EEventID.infect && card.id !== EEventID.thing) {
			events.push(card);
		} else {
			if (gameServer.isMock && card.type === ECardType.panic) {
			} else {
				other.push(card);
			}
		}
		return [events, other]
	}, [[] as ICardEvent[], [] as ICardAny[]]);


	//Один точно будет нечто, поэтому берем playersCount - 1
	const totalCountWithoutThing = (playersCount * handCardsCount) - 1;
	let playersHands = playableCards.slice(0, totalCountWithoutThing);
	//Берем первые карты из отфильтрованной колоды с учтетом -1 для нечто
	playableCards.splice(0, totalCountWithoutThing);
	//Совмещаем остатки всех массивов в один и еще раз перетасуем
	const otherDeck = shuffle(concat([], playableCards, otherCards));
	//Добавляем карту нечто к раздаче
	playersHands.push(thingCard);
	//Еще раз шафлим массив с учетом нечто
	playersHands = shuffle(playersHands);

	game.deck = otherDeck;
	const playerList = Object.keys(game.players);
	if (gameServer.isMock) {
		game.playersList = playerList;
	} else {
		game.playersList = shuffle(playerList);
	}



	//Выдаем игрокам на руки карты
	const playersIdsArray = Object.keys(game.players)
	each(range(playersCount), (playerIndex) => {
		const currentPlayerId = playersIdsArray[playerIndex];
		const currentPlayer = game.players[currentPlayerId];

		let currentPlayerHand = playersHands.slice(0, handCardsCount);
		playersHands.splice(0, handCardsCount);
		currentPlayer.hand = currentPlayerHand;
		each(currentPlayerHand, (card: ICardEvent) => {
			if (card.id === EEventID.thing) {
				currentPlayer.isInjured = true;
				currentPlayer.isThing = true;
			}
		});
	});

	const playerColors = chroma.cubehelix()
		.start(200)
		.rotations(-0.5)
		.lightness([0.4, 0.6])
		.scale()
		.colors(playersIdsArray.length);

	initialDeck = clone(game.deck);

	each(playersIdsArray, (playerId, index) => {
		const color = playerColors[index];
		const secondColor = chroma.mix(color, '00a70c').hex();
		initialDeck = concat([], clone(initialDeck), clone(game.players[playerId].hand))
		game.players[playerId].color = `linear-gradient(${color}, ${secondColor})`
	});

};
