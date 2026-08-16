import {computed, observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import type {ITimerPayload} from 'client/controllers/socketTypes';
import {playBell} from 'client/helpers/sounds';

/**
 * Отсчёт времени за столом.
 *
 * Таймер сервер заводит не «на ход», а на каждую смену состояния любого игрока
 * (см. Player.changeTurnState) и рассылает его ВСЕМ. Ждать одновременно могут
 * двоих — в обмене на часах и тот, кто отдаёт, и тот, кто отвечает, — а в цепной
 * реакции и весь стол разом, и тогда уведомления приходят пачкой, одно за
 * другим.
 *
 * Отсюда всё устройство этого контроллера: чужие уведомления не должны сбивать
 * мой счёт. Поэтому здесь ведётся только СВОЙ отсчёт — сколько осталось лично
 * мне, — и трогают его лишь мои уведомления. Пока он был общим, в заголовке
 * вкладки цифра скакала: чужая смена состояния сбрасывала счёт на ноль, а чужой
 * playerId выкидывал таймер из заголовка и тут же возвращал.
 *
 * Часам на прицеле хода (см. TurnReticle) отсюда нужен только признак того, что
 * партия идёт: свой круг они отмеряют от начала хода игрока, а не от этапов, на
 * которые его дробит сервер.
 *
 * Живёт всё это на отметках времени, а не на счётчике-накопителе: интервал в
 * фоновой вкладке душат, и накопитель там врёт тем сильнее, чем дольше вкладка
 * свёрнута, — а разница часов остаётся честной. Интервал только будит пересчёт.
 */
export default class TimerController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	// Идёт ли отсчёт за столом вообще: до первого уведомления его нет, а с концом
	// партии он кончается.
	@observable isActive: boolean = false;

	// Свой отсчёт: отпущенные мне секунды и момент, когда их отмерили.
	@observable mineInitSeconds: number = 0;
	@observable mineStartedAt: number = 0;

	// Секундный будильник. Сам по себе ничего не значит — по нему пересчитываются
	// вычисляемые секунды, которые иначе замерли бы: часы не наблюдаемы.
	@observable private tick: number = 0;

	/**
	 * Сколько мне осталось. Ноль — время вышло; дальше сервер всё равно ждёт (см.
	 * server/helpers/askDecision — сам он нажимает только за кнопки решений), и
	 * уходить в минус счётчику незачем.
	 */
	@computed get mySecondsLeft(): number {
		if (!this.mineStartedAt) return 0;
		void this.tick;
		const passed = Math.floor((Date.now() - this.mineStartedAt) / 1000);
		return Math.max(0, this.mineInitSeconds - passed);
	}

	// Идёт ли мой отсчёт вообще: до первого своего уведомления его нет.
	@computed get isMine(): boolean {
		return this.mineStartedAt > 0;
	}

	timer: ReturnType<typeof setInterval> | null = null;
	constructor(root: RootController, parent: RootController) {
		this.root = root;
		this.parent = parent;
		this.socket = root.socketController;
	}

	playSound = playBell;
	clearTimers = () => {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.isActive = false;
		this.clearMine();
	};

	// Свой отсчёт кончился: ход ушёл дальше, и в заголовке вкладки цифрам делать
	// нечего.
	clearMine = () => {
		this.mineInitSeconds = 0;
		this.mineStartedAt = 0;
	};

	initTimer = ({seconds, playerId}: ITimerPayload) => {
		this.isActive = true;
		if (playerId && playerId === this.root.gameController?.currentPlayerId) {
			this.mineInitSeconds = seconds;
			this.mineStartedAt = Date.now();
		}
		if (!this.timer) this.timer = setInterval(() => { this.tick++; }, 1000);
	}
}
