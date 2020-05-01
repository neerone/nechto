import {clone, each, filter, find, map, uniqueId} from "lodash";
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
import {debugLog, shuffle} from 'server/helpers/util';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {thingCard} from 'shared/constant/cards';
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
import clc from 'cli-color';

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
  gameInProcess:boolean = true;
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

  killPlayer = (player) => {

	if (player.isThing) {
		this.notifyAllPlayers(formatPlayerNotification({
		  player: player,
		  notification: {
			type: ENotificationAction.info,
			text: `Игра закончена! ${player.nickname} не справился со своим коварным заданием...`,
		  },
		}));
		this.addLog(`Игра закончена! ${player.nickname} не справился со своим коварным заданием...`)
		this.end('Нечто проиграло');
		return;
	}

    const discardCardIds = player.hand.map(cardToDiscard => cardToDiscard.uniqueId);
    each(discardCardIds, cardUniqueId => {
        player.discardCard(cardUniqueId)
    });
    //Если он до этого торговал в offense trade и в стейте застряла его карта - дискардим карту
    if (this.turnContext && this.turnContext.type === ETurnContextType.trade && this.turnContext.offensePlayer === player) {
      const undiscardedCard = this.turnContext.offenseCard;
      if (undiscardedCard) {
        this.discardedDeckPush(undiscardedCard);
      }
    }

    player.changeTurnState(ETurnState.dead)
    this.playersList = this.playersList.filter(pId => pId !== player.id);
    const alivePlayers = filter(clone(this.playersList), pId => this.players[pId].isAlive());

    const cleanPlayers = filter(alivePlayers, pId => !this.players[pId].isInjured);
    if (cleanPlayers.length === 0) {
      return this.end('Нечто победило');
    }

    if (alivePlayers.length === 1) {
      return this.end('Нечто проиграло');
    }
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

  addLog(log: string, force = false) {
    if (this.gameInProcess || force) {
      debugLog(clc.yellowBright(log))
      this.gameLog.push(log)
    }
  }

  end = (lastMessage) => {
    //this.playersList = [];
    this.addLog(lastMessage ? lastMessage : 'Игра закончена.', true)
    each(this.playersList, (pId) => {
      const pl = this.players[pId];
      pl.changeTurnState(ETurnState.idle);
    });
    this.gameInProcess = false;
  };

  start = () => {
    const players = this.players;
    debugLog('============================================================');
    this.addLog('Игра началась');
    gameStarter(this);
    this.changeTurn(this.playersList[0]);
    checkAllDeckCards(this, !gameServer.isMock);
    this.notifyAllPlayers(formatStartGameEvent({players}))
    this.updateGame();
  };

  shuffleDiscarded = () => {
    this.deck = shuffle(this.discardedDeck);
    this.discardedDeck = [];
  };

  makePanic = (player: Player, panicCard: ICardPanic) => {
    this.discardedDeckPush(panicCard);
    panicAction({player, game: this, panicCard});
    this.updateGame();
  };
  resetGameState = () => {
    this.turnContext = null;
    each(this.players, p => {
      if (p.isAlive()) {
        p.changeTurnState(ETurnState.idle);
      }
    })
  };
  discardedDeckPush(card) {
    //debugLog('DISCARDED CARD', card)
    if (!card) {
      throw new Error('Попытка задискардить undefined')
    }
    this.discardedDeck.push(card)
  }
  changeTurn(playerId: string) {
    if (!this.gameInProcess) return;
    const player = this.players[playerId];
    if (!player) {
      debugLog(this.players)
    }
    this.resetGameState()
    this.turnPlayerId = playerId;
    debugLog(`change turn player id ${playerId}`)

    if (!player.isAlive()) {
      //Дверь и мертвец не может ходить
      const nextPlayer = player.getNextAlivePlayer();
      return this.changeTurn(nextPlayer.id)
    }
    this.addLog(`Ходит игрок ${player.nickname}!`);

    //Удаляем карту из колоды сверху и даем её игроку
	let grabbedCard = this.getFirstCard();
    //Если паника, то прекращаем граббинг и создаем панику
    if (grabbedCard.type === ECardType.panic) {
      return this.makePanic(player, grabbedCard);
    }

    // Добавляем поднятую карту игроку на руку
    player.getCard(grabbedCard);

    player.changeTurnState(ETurnState.inCardAction);
    this.addLog(`Игрок ${player.nickname} взял карту и ходит...`);
    this.updateGame();
  }

  endTurn(playerId: string) {
    if (!this.gameInProcess) return
    this.turnContext = null;
    const endTurnPlayer = this.players[playerId];
    endTurnPlayer.changeTurnState(ETurnState.idle);
    const nextPlayer = endTurnPlayer.getNextAlivePlayer();
    debugLog(`Игрок ${endTurnPlayer.nickname} заканчивает ход`, map(endTurnPlayer.hand, card=> card.id))
    debugLog(`След. игрок ${nextPlayer.nickname}`)
    this.changeTurn(nextPlayer.id);
    checkAllDeckCards(this, !gameServer.isMock);
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



  infectPlayer = (playerId: string) => {
    if (!this.players[playerId]) {
      console.error('Неудалось заразить игрока, т.к не было найдено его ID', playerId);
      return;
    }
    this.players[playerId].isInjured = true;

    const cleanPlayerId = find(this.playersList, (pId) => {
      const pl = this.players[pId];
      return pl.state === EPlayerState.dummy && !pl.isThing && !pl.isInjured
    });
    const notificationPlayer = this.players[playerId];
    if (!cleanPlayerId) {
      this.notifyAllPlayers(formatPlayerNotification({
        player: notificationPlayer,
        notification: {
          type: ENotificationAction.okayCard,
          cards: [thingCard],
          text: 'Нечто выйграло'
        },
      }))
      this.end('Нечто победило');
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
    return grabbedCard;
  }

  pickFirstEventCard(): ICardEvent {
    const firstCard = this.getFirstCard();
    this.addLog('Игрок достает карту событий...')
    if (firstCard.type === ECardType.panic) {
      this.addLog('Попалась паника. Игрок берет следующую карту...');
      this.discardedDeckPush(firstCard);
      return this.pickFirstEventCard();
    }
    return firstCard;
  }

  grabEventCardFromDeck({player}: {player: Player}) {
    const eventCard = this.pickFirstEventCard();
    debugLog(`Игрок ${player.nickname} взял карту ${eventCard.id}`)
    player.getCard(eventCard);
  }

  cardAction({
    player,
    actionType,
    cardUniqueId,
    selectedPlayerId,
    action,
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId: string,
    selectedPlayerId:string,
    action? : string;
  }) {
    if (!this.gameInProcess) return;
    if (cardUniqueId) {
      const card = find(player.hand, {uniqueId: cardUniqueId})
      debugLog(`Player ${player.nickname} igraet ${actionType} kartoi ${cardUniqueId} - ${card && card.id}`);
    }
    if (selectedPlayerId) {
      const selectedPlayer = this.players[selectedPlayerId]
      debugLog(`Player ${player.nickname} выбирает игрока ${selectedPlayer.nickname}`);
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
        actCard({game: this, player, cardUniqueId});
        this.updateGame();
        return;
      case EPlayerActionType.cardSelect:
        selectCard({game: this, player, cardUniqueId});
        this.updateGame();
        return;
      case EPlayerActionType.playerSelect:
        selectPlayer({game: this, player, selectedPlayerId});
        this.updateGame();
        return;
      case EPlayerActionType.actionDecision:
        playerActionDecision({game: this, player, action});
        this.updateGame();
        return;
    }
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
