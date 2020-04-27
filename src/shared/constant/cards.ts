import {each, uniqueId} from 'lodash';

import {ECardType, EEventID, EEventType, EPanicID} from 'shared/enum/cards';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

export const cardAspectRatio = 1.3957;

const events: {[key: string]: ICardEvent} = {
  [EEventID.tenacity]: {
    type: ECardType.event,
    id: EEventID.tenacity,
    eventType: EEventType.playable,
    description:
      "Возьмите три карты событий, оставьте на руке одну и сбросьте остальные две. Затем сыграйте или сбросьте одну карту",
    playersCount: [4,4,6,9,10],
  },
  [EEventID.fear]: {
    type: ECardType.event,
    id: EEventID.fear,
    eventType: EEventType.antiTrade,
    description:
      "Откажитесь от обмена картами и посмотрите карту, от которой отказались. Возьмите одну карту события.",
    playersCount: [5,6,8,11],
  },
  [EEventID.suspicion]: {
    type: ECardType.event,
    id: EEventID.suspicion,
    eventType: EEventType.playable,
    description: "Посмотрите одну случайную карту на руке соседнего игрока.",
    playersCount: [4,4,4,4,7,8,9,10]

  },
  [EEventID.leaveMeAlone]: {
    type: ECardType.event,
    id: EEventID.leaveMeAlone,
    eventType: EEventType.antiSwap,
    description:
      'Отмените эффект карты "Меняемся местами" или "Сматывай удочки", если стали её целью. Возьмите одну карту события',
    playersCount: [4,6,11],
  },
  [EEventID.positionswap]: {
    type: ECardType.event,
    id: EEventID.positionswap,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь местами с соседним игроком, если он не на каратине и не за заколоченной дверью.",
    playersCount: [4,4,7,9,11]
  },
  [EEventID.flamethrower]: {
    type: ECardType.event,
    id: EEventID.flamethrower,
    eventType: EEventType.playable,
    description: "Соседний игрок выбывает из игры.",
    playersCount: [4,4,6,9,11]
  },
  [EEventID.reelFishingRods]: {
    type: ECardType.event,
    id: EEventID.reelFishingRods,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь местами с любым игроком по вашему выбору, если он не на карантине. Игнорируйте все заколоченные двери",
    playersCount: [4,4,7,9,11]
  },
  [EEventID.axe]: {
    type: ECardType.event,
    id: EEventID.axe,
    eventType: EEventType.axe,
    description:
      'Сбросьте сыгранную на вас или на соседнего игрока карту карантин или выложенную между вами карту "Заколоченная дверь"',
    playersCount: [4,9]
  },
  [EEventID.lookaround]: {
    type: ECardType.event,
    id: EEventID.lookaround,
    eventType: EEventType.playable,
    description:
      "Очередность хода передается в обратную сторону. Меняется порядок хода игроков и направление обмена картами с соседом.",
    playersCount: [4,9]
  },
  [EEventID.whiskey]: {
    type: ECardType.event,
    id: EEventID.whiskey,
    eventType: EEventType.playable,
    description:
      "Покажите все свои карты остальным игрокам. Эту карту можно сыграть только на себя.",
    playersCount: [4,6,10]
  },
  [EEventID.barricade]: {
    type: ECardType.event,
    id: EEventID.barricade,
    eventType: EEventType.playable,
    description:
      "Положите эту карту между собой и соседним игроком. Между вами не может совершаться никаких действий или обменов.",
    playersCount: [4,7,11]
  },
  [EEventID.seduction]: {
    type: ECardType.event,
    id: EEventID.seduction,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь одной картой с любым игроком по вашему выбору если он не на карантине. Ваш ход заканчивается.",
    playersCount: [4,4,6,7,8,10,11],
  },
  [EEventID.infect]: {
    type: ECardType.event,
    id: EEventID.infect,
    eventType: EEventType.infect,
    description:
      "Получив эту карту от другого игрока вы становитесь зараженым и обязаны держать её на руке до конца игры.",
    playersCount: [4,4,4,4,4,4,4,4,6,6,7,7,8,9,9,10,10,11,11,11],
  },
  [EEventID.quarantine]: {
    type: ECardType.event,
    id: EEventID.quarantine,
    eventType: EEventType.playable,
    description:
      "Сыграйте эту карту на себя или соседнего игрока. Следующие три своих хода игрок на карантине не может меняться картами, играть карты событий или становиться целью таких карт.",
    playersCount: [5,9],
  },
  [EEventID.noFire]: {
    type: ECardType.event,
    id: EEventID.noFire,
    eventType: EEventType.antiFire,
    description:
      'Отмените эффект карты Огнемет, если стали её целью. Возьмите одну карту события.',
    playersCount: [4,6,11],
  },
  [EEventID.analysis]: {
    type: ECardType.event,
    id: EEventID.analysis,
    eventType: EEventType.playable,
    description: "Посмотрите карты на руке соседнего игрока.",
    playersCount: [5,6,9],
  },
  [EEventID.noThanks]: {
    type: ECardType.event,
    id: EEventID.noThanks,
    eventType: EEventType.antiTrade,
    description: "Откажитесь от обмена картами. Возьмите одну карту события.",
    playersCount: [4,6,8,11],
  },
  [EEventID.miss]: {
    type: ECardType.event,
    id: EEventID.miss,
    eventType: EEventType.antiTrade,
    description:
      "Откажитесь от обмена картами. Вместо вас картами меняется следующий за вами игрок. Возьмите одну карту события.",
    playersCount: [4,6,11]
  },
};

const panic = {
  [EPanicID.threeFour]: {
    type: ECardType.panic,
    id: EPanicID.threeFour,
    description: 'Все сыгранные карты "Заколоченная дверь" сбрасываются.',
    playersCount: [4,9],

  },
  [EPanicID.chainReaction]: {
    type: ECardType.panic,
    id: EPanicID.chainReaction,
    description:
      'Каждый игрок одновременно с остальными отдает одну карту следующему по порядку хода игроку, игнорируя все сыгранные карты "Карантин" и "Заколоченная дверь". Вы не можете отказаться от получения карты при помощи других карт. Нечто может заразить другого игрока, передав ему карту заражения. Ваш ход заканчивается.',
    playersCount: [4,9],

  },
  [EPanicID.blindDate]: {
    type: ECardType.panic,
    id: EPanicID.blindDate,
    description:
      "Поменяйте одну карту с руки на верхнюю карту общей колоды, сбрасывая все попадающиеся карты паники. Ваш ход заканчивается",
    playersCount: [4,9],

  },
  [EPanicID.oldRopes]: {
    type: ECardType.panic,
    id: EPanicID.oldRopes,
    description: "Все сыгранные карты карантин сбрасываются.",
    playersCount: [6,9],

  },
  [EPanicID.oneTwo]: {
    type: ECardType.panic,
    id: EPanicID.oneTwo,
    description:
      "Поменяйтесь местами с третьим от вас игроков слева или справа по вашему выбору. Игнорируйте все заколоченные двери. Если игрок на карантине смены мест не происходит.",
    playersCount: [5,9],
  },
  [EPanicID.onlyBetweenUs]: {
    type: ECardType.panic,
    id: EPanicID.onlyBetweenUs,
    description:
      "Покажите все карты на руке соседнему игроку по вашему выбору.",
    playersCount: [7,9],
  },
  [EPanicID.youCallThisParty]: {
    type: ECardType.panic,
    id: EPanicID.youCallThisParty,
    description:
      "Все сыгранные карты карантин и заколоченная дверь сбрасываются. Затем, начиная с вас и по часовой стрелке все игроки парами меняются местами. В случае нечетного числа игроков, последний игрок остается на месте.",
    playersCount: [5,9],
  },
  [EPanicID.goAway]: {
    type: ECardType.panic,
    id: EPanicID.goAway,
    description:
      "Поменяйтесь местами с любым игроком по вашему выбору, если он не на карантине.",
    playersCount: [5],
  },
  [EPanicID.oops]: {
    type: ECardType.panic,
    id: EPanicID.oops,
    description: "Покажите все свои карты на руке остальным игрокам.",
    playersCount: [10],
  },
  [EPanicID.friendship]: {
    type: ECardType.panic,
    id: EPanicID.friendship,
    description:
      "Поменяйтесь одной картой с любым игроком по вашему выбору, если он не на карантине. Ваш ход заканчивается.",
    playersCount: [7,9],
  },
  [EPanicID.forgetfulness]: {
    type: ECardType.panic,
    id: EPanicID.forgetfulness,
    description:
      "Сбросьте три карты с руки и возьмите три новые карты событий. Сбрасывайте все попадающиеся карты паники.",
    playersCount: [4],
  },



  //[EPanicID.recognitionTime]: {
  //  type: ECardType.panic,
  //  id: EPanicID.recognitionTime,
  //  description:
  //    "Начиная с вам и по порядку хода, каждый игрок либо показывает, либо не показывает все карты на руке остальным игрокам. Время признаний заканчивается, когда кто-то из игроков показывает карту заражения, при этом нет необходимости показывать остальные карты на руке.",
  //  playersCount: [8],
  //},
};

const cardBacks : {[key: string]: any} = {
  eventBack: {
    type: ECardType.back,
    id: "eventBack",
    description:'',
    playersCount: [],
  },
  panicBack: {
    type: ECardType.back,
    id: "panicBack",
    description:'',
    playersCount: [],
  },
};

const thingCard : ICardEvent = {
  type: ECardType.event,
  id: EEventID.thing,
  uniqueId: 'thing_card_unique_id',
  description: "Ты нечто.",
  playersCount: [0],
};

const fulldeck = Object.assign({}, events, panic, cardBacks) as {[key: string]: ICardEvent};

export const handCardsCount = 4;

let fullDeckObject = {};
each(fulldeck, card => {
	fullDeckObject[card.id] = card
});

export const getCard = (cardId) : ICardEvent => {
  if (!fullDeckObject[cardId]) {
    console.error('Не удается найти карту ',  cardId)
    throw new Error('Алярм')
  }
  return {...fullDeckObject[cardId], uniqueId: uniqueId('card_')}
}

export const getPanic = (cardId) : ICardPanic => {
  return {...fullDeckObject[cardId], uniqueId: uniqueId('card_')}
}

export { fulldeck, thingCard, cardBacks, fullDeckObject };
