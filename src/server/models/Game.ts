import {each, find, uniqueId} from "lodash";
import {Player} from "server/models/Player";
import {gameServer} from 'server/server/GameServer';
import {
  formatPlayerConnectedEvent,
  formatPlayerConnectionSuccessEvent,
  formatPlayerNotification,
  formatStartGameEvent,
  formatUpdateGameEvent,
} from 'server/formatters/formatOutgoingEvents';
import {gameStarter} from 'server/helpers/gameStarter';
import {shuffle} from 'server/helpers/util';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {handCardsCount, thingCard} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import INotificationAction from 'shared/interfaces/notification';
import {ICardAny, ICardEvent, ICardPanic} from 'shared/interfaces/cards';
import {actCard, playerActionDecision, selectCard, selectPlayer} from 'server/helpers/playerAction';
import {ITurnContext} from 'shared/interfaces/turnContext';
import {tradeCard} from 'server/helpers/tradeCard';
import {discardCardAction} from 'server/helpers/discardCard';
import {ECardType} from 'shared/enum/cards';
import {panicAction} from 'server/helpers/panicActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {chainReactionTrade} from 'server/helpers/cardActions/panic/chainReaction';
import {ENotificationAction} from 'shared/enum/notifications';
import {checkAllDeckCards} from '_integration/helpers';

enum EGameState {
  lobby = "lobby",
}

export class Game {
  id = null;
  state: EGameState = EGameState.lobby;
  players: { [key: string]: Player } = {};
  playersList: string[] = [];
  deck: ICardAny[] = [];
  discardedDeck: ICardAny[] = [];
  turnPlayerId: string | null = null;
  isClockwise : boolean = true;
  gameLog: string[] = [];
  turnContext: ITurnContext | null = null;

  constructor({ player }) {
    this.id = uniqueId("game_");
    this.players[player.id] = player;
  }

  notifyAllPlayers = (event) => {
    each(this.players, (p) => {
      p.notify(event);
    })
  };

  notifyAllPlayersExeptPlayer = (event, player) => {
    each(this.players, (p) => {
      if (p === player) return;
      p.notify(event);
    })
  };

  notifyPlayer = ({player, notification} : {player: Player, notification: INotificationAction}) => {
    player.notify(formatPlayerNotification({ player, notification }));
  }

  connectPlayer({ player }: {player: Player}) {
    this.players[player.id] = player;
    this.playersList.push(player.id);
    const players = this.players;
	player.notify(formatPlayerConnectionSuccessEvent({player: player, game: this, players}));
	player.socket.join(this.id);
    this.notifyAllPlayers(formatPlayerConnectedEvent({viewer: player, game: this}))
  }

  disconnectPlayer({ player }: {player: Player}) {
    delete this.players[player.id];
    player.socket.leave(this.id);
    this.updateGame();
  }

  updateGame = () => {
    const players = this.players;
    each(players, (player: Player) => {
      player.notify(formatUpdateGameEvent({game: this, viewer: player}))
    })
  };

  addLog(log: string) {
    console.info(log)
    this.gameLog.push(log)
  }

  start = () => {
    const players = this.players;
    this.addLog('Игра началась');
    gameStarter(this);
    this.notifyAllPlayers(formatStartGameEvent({players}))
    this.updateGame();
  };

  shuffleDiscarded = () => {
    this.deck = shuffle(this.discardedDeck);
    this.discardedDeck = [];
  };

  makePanic = (player: Player, panicCard: ICardPanic) => {
    panicAction({player, game: this, panicCard});
    this.discardedDeck.push(panicCard);
    this.updateGame();
  };
  resetPlayerStates = () => {
    this.turnPlayerId = null;
    each(this.players, p => {
      p.changeTurnState(ETurnState.idle);
    })
  };

  changeTurn(playerId: string) {
    this.turnPlayerId = playerId;
    const player = this.players[playerId];
    this.addLog(`Ходит игрок ${player.nickname}!`);

    //if (player.id !== this.turnPlayerId) { console.error('Попытка взять карту не в свой ход'); return; }
    if (player.hand.length > handCardsCount + 1) { console.error('Попытка взять карту если карт больше ' + handCardsCount); return; }

    //Удаляем карту из колоды сверху и даем её игроку
	let grabbedCard = this.getFirstCard();
    //Если паника, то прекращаем граббинг и создаем панику
    if (grabbedCard.type === ECardType.panic) {
      return this.makePanic(player, grabbedCard);
    }

    // Добавляем поднятую карту игроку на руку
    player.hand.push(grabbedCard);
    // Меняем статус игрока
    each(this.players, player => {
      player.changeTurnState(ETurnState.idle);
    });
    player.changeTurnState(ETurnState.inCardAction);
    this.addLog(`Игрок ${player.nickname} взял карту и ходит...`);
    this.updateGame();
  }

  endTurn(playerId: string) {
    this.turnContext = null;
    const endTurnPlayer = this.players[playerId];
    endTurnPlayer.changeTurnState(ETurnState.idle);
    const nextPlayer = this.getPlayerByPosition({playerId, isNext: true});
    if (nextPlayer.state === EPlayerState.door) {
      return this.endTurn(nextPlayer.id);
    }
    checkAllDeckCards(this, !gameServer.isMock);
    this.changeTurn(nextPlayer.id);
  }


  getPlayerByPosition = ({playerId, isNext}: {playerId: string, isNext: boolean}) : Player => {
    const currentPlayerIndex = this.playersList.indexOf(playerId);

    const clockwiseNext = this.playersList[currentPlayerIndex + 1] || this.playersList[0];
    const clockwisePrev = this.playersList[currentPlayerIndex - 1] || this.playersList[this.playersList.length - 1];


    let getPlayerId = null;
    if (this.isClockwise) {
      //По часовой стрелке
      if (isNext) {
        getPlayerId = clockwiseNext;
      } else {
        getPlayerId = clockwisePrev;
      }
    } else {
      //Против часовой стрелки
      if (isNext) {
        getPlayerId = clockwisePrev;
      } else {
        getPlayerId = clockwiseNext;
      }
    }

    if (!getPlayerId) { console.error('Ошибка! Не удалось получить следующего игрока') }
    return this.players[getPlayerId];
  };



  injurePlayer = (playerId: string) => {
    if (!this.players[playerId]) {
      console.error('Неудалось заразить игрока, т.к не было найдено его ID', playerId);
      return;
    }
    this.players[playerId].isInjured = true;
    const cleanPlayer = find(this.players, (pl) => {
      return pl.state === EPlayerState.dummy && !pl.isThing && !pl.isInjured
    });
    if (!cleanPlayer) {
      this.notifyAllPlayers(formatPlayerNotification({
        player: cleanPlayer,
        notification: {
          type: ENotificationAction.okayCard,
          cards: [thingCard],
          text: 'Нечто выйграло'
        },
      }))
    }
  };

  getFirstCard(): ICardEvent | ICardPanic {
    if (this.deck.length === 0) {
      this.addLog('Колода закончилась, мешаем карты');
      this.shuffleDiscarded();
      return this.getFirstCard();
    }
	let grabbedCard = this.deck.slice(0, 1)[0];
    if (!grabbedCard) {
      return this.getFirstCard();
    }
	this.deck.splice(0, 1);
/*    console.log('=====DECK', this.deck.length, this.discardedDeck.length, this.deck.length + this.discardedDeck.length, this.discardedDeck.map(card => {
      if (card === undefined) {
        console.log('CARD IS INDEDINED', this.discardedDeck)
        return 'TEST!!!';
      }
      return card.id
    }))*/
    return grabbedCard;
  }

  pickFirstEventCard(): ICardEvent {
    const firstCard = this.getFirstCard();
    this.addLog('Игрок достает карту событий...')
    if (firstCard.type === ECardType.panic) {
      this.addLog('Попалась паника. Игрок берет следующую карту...');
      this.discardedDeck.push(firstCard);
      return this.pickFirstEventCard();
    }
    return firstCard;
  }

  grabEventCardFromDeck({player}: {player: Player}) {
    const eventCard = this.pickFirstEventCard();
    player.hand.push(eventCard);
  }

  cardAction({
    player,
    actionType,
    cardUniqueId,
    selectedPlayerId,
    actionContext
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId: string,
    selectedPlayerId:string,
    actionContext?:any
  }) {

    if (cardUniqueId) {
      const card = find(player.hand, {uniqueId: cardUniqueId})
      console.log(`Player ${player.nickname} igraet ${actionType} kartoi ${cardUniqueId} - ${card && card.id}`);
    }
    if (selectedPlayerId) {
      const selectedPlayer = this.players[selectedPlayerId]
      console.log(`Player ${player.nickname} выбирает игрока ${selectedPlayer.nickname}`);
    }
    switch (actionType) {
      case EPlayerActionType.cardDiscard:
        discardCardAction({game: this, player, cardUniqueId});
        this.updateGame();
        return;
      case EPlayerActionType.cardTrade:
        if (this.turnContext && this.turnContext.type === ETurnContextType.chainReaction) {
          chainReactionTrade({game: this, player, cardUniqueId});
        } else {
          tradeCard({game: this, player, cardUniqueId});
        }
        this.updateGame();
        return;
      case EPlayerActionType.cardAct:
        actCard({game: this, player, cardUniqueId, actionContext});
        this.updateGame();
        return;
      case EPlayerActionType.cardSelect:
        selectCard({game: this, player, cardUniqueId, actionContext});
        this.updateGame();
        return;
      case EPlayerActionType.playerSelect:
        selectPlayer({game: this, player, selectedPlayerId, actionContext});
        this.updateGame();
        return;
    }
  };

  actionDecision = ({player, action}) => {
    console.log(`Player ${player.nickname} выбирает action ${action}`)
    playerActionDecision({game: this, player, action});
    this.updateGame();
  };

  swapPlayers = (AId,BId) => {
    const AIndex = this.playersList.indexOf(AId);
    const BIndex = this.playersList.indexOf(BId);
    this.playersList[AIndex] = BId;
    this.playersList[BIndex] = AId;
  };

  destroy() {
    //flush logic
  }
}
