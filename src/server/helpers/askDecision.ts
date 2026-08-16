import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {
	formatPlayerNotification,
	formatSoundNotification,
	formatTimerNotification,
} from 'server/formatters/formatOutgoingEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {gameServer} from 'server/server/GameServer';
import type INotificationAction from 'shared/interfaces/notification';

type TDecisionMenu = {text: string, action: string}[];

// Сколько игрок думает над решением, прежде чем сервер ответит за него. Поле, а
// не константа: тестам незачем ждать полминуты живого времени.
export const decisionTimeout = {seconds: 30};

// По одному таймеру на игрока: новый вопрос отменяет старый.
const timers = new WeakMap<Player, ReturnType<typeof setTimeout>>();

export const clearDecisionTimer = (player: Player) => {
	const timer = timers.get(player);
	if (!timer) return;
	clearTimeout(timer);
	timers.delete(player);
};

/**
 * Спрашиваем у игрока решение — всегда, даже когда вариант всего один. Кнопка
 * без выбора выглядит лишней, но без вопроса сам факт паузы выдавал бы карту:
 * если стол ждёт ответа только у того, кому есть чем ответить, то мгновенное
 * сожжение означает «шашлыка на руке нет».
 *
 * Чтобы игра не стояла на думающем или ушедшем игроке, через decisionTimeout
 * сервер жмёт кнопку сам — последнюю в меню: защитную карту, если она есть
 * («никакого шашлыка», «мне и здесь неплохо»), иначе единственный вариант.
 */
export const askDecision = ({asker, decider, text, menu}: {
	asker: Player,
	decider: Player,
	text: string,
	menu: TDecisionMenu,
}): void => {
	clearDecisionTimer(decider);
	const fallback = menu[menu.length - 1];
	const notification: INotificationAction = {
		type: ENotificationAction.actionDecision,
		text,
		menu,
		...(fallback ? {seconds: decisionTimeout.seconds, defaultAction: fallback.action} : {}),
	};
	decider.notify(formatPlayerNotification({player: asker, notification}));

	if (!fallback) return;
	decider.notify(formatSoundNotification());
	// Отсчёт видят все: стол должен понимать, кого он ждёт (см. TurnTimerRing).
	decider.game.notifyAllPlayers(formatTimerNotification({
		text: `${decider.nickname} принимает решение`,
		seconds: decisionTimeout.seconds,
		playerId: decider.id,
	}));

	const timer = setTimeout(() => {
		timers.delete(decider);
		// Игрок успел ответить сам (или игра ушла дальше) — не вмешиваемся:
		// currentAction — тот самый объект, который мы ему отправили.
		if (decider.currentAction !== notification) return;
		if (!decider.game.gameInProcess) return;
		try {
			// Тем же путём, что и нажатие живого игрока: с проверками и с
			// продолжением ходов ботов.
			gameServer.playerAction({
				player: decider,
				actionType: EPlayerActionType.actionDecision,
				action: fallback.action,
			});
		} catch (e) {
			console.error('[decision] auto action error:', e);
		}
	}, decisionTimeout.seconds * 1000);
	// Незакрытый вопрос не должен держать процесс живым.
	timer.unref();
	timers.set(decider, timer);
};
