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
 * Поэтому отсчётов здесь два, и путать их нельзя:
 *
 * — общий: кого стол ждёт прямо сейчас. Его перезапускает любое уведомление,
 *   чьё бы оно ни было, — по нему бежит стрелка на прицеле хода (см.
 *   TurnReticle), и ей это ровно и нужно: сменился ожидаемый — стрелка пошла
 *   заново;
 *
 * — свой: сколько осталось лично мне. Его трогают только мои уведомления. Раньше
 *   он был общим с первым, и в заголовке вкладки цифра скакала — чужая смена
 *   состояния сбрасывала мой счёт на ноль, а чужой playerId выкидывал таймер из
 *   заголовка и тут же возвращал.
 *
 * Обе половины живут на отметках времени, а не на счётчике-накопителе: интервал
 * в фоновой вкладке душат, и накопитель там врёт тем сильнее, чем дольше вкладка
 * свёрнута, — а разница часов остаётся честной. Интервал только будит пересчёт.
 */
export default class TimerController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable isActive: boolean = false;
	// Отпущенные секунды и момент старта общего отсчёта.
	@observable initSeconds: number = 0;
	@observable startedAt: number = 0;
	@observable text: string = '';
	// Чей ход отсчитывается — уведомление приходит всем, а свой отсчёт мы ведём
	// только по своим.
	@observable playerId: string = '';

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
		this.text = 'Игра завершена';
		this.initSeconds = 0;
		this.startedAt = 0;
		this.isActive = false;
		this.playerId = '';
		this.clearMine();
	};

	// Свой отсчёт кончился: ход ушёл дальше, и в заголовке вкладки цифрам делать
	// нечего.
	clearMine = () => {
		this.mineInitSeconds = 0;
		this.mineStartedAt = 0;
	};

	initTimer = ({text, seconds, playerId}: ITimerPayload) => {
		this.text = text;
		this.initSeconds = seconds;
		this.startedAt = Date.now();
		this.isActive = true;
		this.playerId = playerId;
		if (playerId && playerId === this.root.gameController?.currentPlayerId) {
			this.mineInitSeconds = seconds;
			this.mineStartedAt = Date.now();
		}
		if (!this.timer) this.timer = setInterval(() => { this.tick++; }, 1000);
	}
}
