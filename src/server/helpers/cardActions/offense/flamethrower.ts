import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {each, find, map} from 'lodash';

export const flamethrowerAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.burn,
		offensePlayer: player,
		defensePlayer: null,
	};

	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого ты хочешь сжечь'
      },
    }));
};

export const flamethrowerSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.burn) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	const defensePlayer = game.players[selectedPlayerId];
	player.currentAction = null;
	game.turnContext = {
		type: ETurnContextType.burn,
		offensePlayer: player,
		defensePlayer: defensePlayer,
	};
    let decisionMenu = [{
		text: 'Сгореть',
		action: 'burn',
	}];
	let text = `Игрок ${player.nickname} хочет использовать на тебе огнемет`;
	game.addLog(`Игрок ${player.nickname} используем огнемет на ${defensePlayer.nickname}`)
	const hasNoFireCard = !!find(defensePlayer.hand, {id: EEventID.noFire});
	if (hasNoFireCard) {
		decisionMenu.push({
			text: 'Использовать шашлык',
			action: 'noFire',
		});
		text = `Игрок ${player.nickname} использует на тебе огнемет, но у тебя есть "Никакого шашлыка"`
	}
    defensePlayer.notify(formatPlayerNotification({
		player: player,
		notification: {
			type: ENotificationAction.actionDecision,
			text,
			menu: decisionMenu
		},
    }));
};


export const flamethrowerFinish = ({game, player, action} : {game: Game, player: Player, action:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.burn) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	const {defensePlayer, offensePlayer} = game.turnContext;
	switch (action) {
		case "burn": {
			game.killPlayer(defensePlayer)
			if (!game.gameInProcess) return;
			game.notifyAllPlayers(formatPlayerNotification({
			  player: player,
			  notification: {
				type: ENotificationAction.okayCard,
				cards: [getCard(EEventID.flamethrower)],
				text: `Игрок ${defensePlayer.nickname} был заживо сожжен игроком ${offensePlayer.nickname} и выбывает из игры`,
			  },
			}));
			game.addLog(`Игрок ${defensePlayer.nickname} был заживо сожжен игроком ${offensePlayer.nickname} и выбывает из игры`);

			break;
		}
		case "noFire": {
			const noFireCard = find(defensePlayer.hand, {id: EEventID.noFire});
			game.notifyAllPlayers(formatPlayerNotification({
				player: player,
				notification: {
					type: ENotificationAction.okayCard,
					cards: [getCard(EEventID.noFire)],
					text: `Игрок ${defensePlayer.nickname} использовал "Никакого шашлыка" и спасся от огнемета!`,
				},
		    }));
			//discardCard({player: defensePlayer, cardUniqueId: noFireCard.uniqueId, game});
			defensePlayer.discardCard(noFireCard.uniqueId)
			game.grabEventCardFromDeck({player});
			break;
		}
	}
	game.turnContext = null;
	offensePlayer.changeTurnState(ETurnState.inOffenseTrade);
};
