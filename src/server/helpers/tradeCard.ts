import {Player} from 'server/models/Player';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {getCard} from 'shared/constant/cards';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ECardType, EEventID} from 'shared/enum/cards';
import {Game} from 'server/models/Game';
import {ETurnContextType} from 'shared/enum/turnContextType';
import { remove } from 'lodash';
import {seductionTradeFinish} from 'server/helpers/cardActions/offense/seduction';

export const tradeCard = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  const tradingCard = player.getCardByUniqueId(cardUniqueId);
  if (tradingCard.type !== ECardType.event) {
    throw new Error(`Попытка обменяться НЕ картой эвента ${JSON.stringify(tradingCard)}`);
  }
  const context = game.turnContext;
  if (!context || context.type !== ETurnContextType.trade) {
    console.info('CONTEXT', context && context.type)
    throw new Error('Торговля произошла без контекста trade');
  }
  const isOffenseTrade = player.turnState === ETurnState.inOffenseTrade;
  let playerToTrade: Player = context.defensePlayer;

  if (isOffenseTrade) {
    remove(player.hand, (card) => { return card.uniqueId === cardUniqueId});
    playerToTrade.changeTurnState(ETurnState.inDefenseTrade);

    player.changeTurnState(ETurnState.idle);
    game.addLog(`Игрок ${player.nickname} передает карту для обмена игроку ${playerToTrade.nickname}`);
    game.turnContext = {
      type: ETurnContextType.trade,
      defensePlayer: playerToTrade,
      offensePlayer: player,
      offenseCardId: tradingCard.id,
    };
    return;
  }
  remove(player.hand, (card) => { return card.uniqueId === cardUniqueId});
  //isDefense trade
  if (context.type !== ETurnContextType.trade) {
    console.error('Нет выбранной карты для обмена у игрока', player.id);
    return;
  }
  let offensePlayer = context.offensePlayer;
  let defensePlayer = context.defensePlayer;
  offensePlayer.changeTurnState(ETurnState.idle);
  game.addLog(`Игроки ${player.nickname} и ${offensePlayer.nickname} обменялись картами`);



  const offensePlayerCard = getCard(context.offenseCardId);
  const defensePlayerCard = tradingCard;
  /* OFFENSE CARD PUSH */
  offensePlayer.getCard(defensePlayerCard);
  offensePlayer.notify(formatPlayerNotification({
    player: player,
    notification: {
      type: ENotificationAction.okayCard,
      cards: [defensePlayerCard],
      text: `Игрок ${player.nickname} дал эту карту`,
    },
  }));
  if (defensePlayerCard.id=== EEventID.infect) {
    game.infectPlayer(offensePlayer.id);
  }

  /* DEFENSE CARD PUSH */
  defensePlayer.getCard(offensePlayerCard);
  defensePlayer.notify(formatPlayerNotification({
    player: defensePlayer,
    notification: {
      type: ENotificationAction.okayCard,
      cards: [offensePlayerCard],
      text: `Игрок ${offensePlayer.nickname} дал эту карту`,
    },
  }));
  if (offensePlayerCard.id=== EEventID.infect) {
    game.infectPlayer(defensePlayer.id);
  }
  defensePlayer.changeTurnState(ETurnState.idle)

  //if (game.turnContext && game.turnContext.type === ETurnContextType.seduction) {
  //  return seductionTradeFinish({game})
  //}
  game.turnContext = null;
  game.endTurn(offensePlayer.id);
  //game.changeTurn(player.id)

};
