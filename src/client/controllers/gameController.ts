import {action, computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import type INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType, EEventID} from 'shared/enum/cards';
import {burnMs, burnTailMs} from 'client/helpers/burnTiming';
import {EAppState, EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import type {IFormatCardDraw, IFormatCardEffect, IFormatPanicCard, IFormatTradeContext} from 'shared/interfaces/common';
import fscreen from 'fscreen';
import {difference, each, every, filter, find, includes, keys, merge, reduce, some, without} from "lodash";
import {EAsyncState} from 'shared/enum/async';
import type {
	IDeckPayload,
	IGameUpdatePayload,
	IHandActionsMap,
	IHandMap,
	IPlayersMap,
} from 'client/controllers/socketTypes';
import {ENotificationAction} from 'shared/enum/notifications';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {playDiscard, playGameEnd, playMove, playPanic, startMusic, startPilotFlame, stopMusic, stopPilotFlame} from 'client/helpers/sounds';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

// Вид стола — настройка игрока, а не игры: её спрашивают один раз и помнят.
// Локальное хранилище, а не localforage (им хранится ник): читать надо
// синхронно, в первом же кадре стола, иначе он успевает нарисоваться в одном
// виде и перескочить в другой.
const firstPersonTableKey = 'isFirstPersonTable';

const loadFirstPersonTable = (): boolean => {
	try {
		return window.localStorage.getItem(firstPersonTableKey) === 'true';
	} catch {
		// Приватный режим и запрет на хранилище: играть это не мешает, стол
		// просто останется в виде по умолчанию.
		return false;
	}
};

const saveFirstPersonTable = (value: boolean): void => {
	try {
		window.localStorage.setItem(firstPersonTableKey, String(value));
	} catch {
		// см. loadFirstPersonTable
	}
};

// Сколько карта паники минимум лежит на столе, даже если само её событие
// отыгралось мгновенно: столько нужно, чтобы стол успел прочитать, что вообще
// произошло. Пока карта там, новую из колоды не тянут.
const panicCardHoldMs = 5000;

// Карты, которые сейчас входят в мою руку или выходят из неё, и другой конец их
// пути: id игрока или null — колода.
export interface ICardMove {
	cardIds: string[];
	playerId: string | null;
}

// Передача карты бывает только в этих контекстах хода. Огнемёт и смена мест тоже
// связывают двух игроков, но карты между ними не ходят, и принимать их за обмен
// нельзя: иначе сброшенный «никакой шашлык» улетал бы поджигателю в кружок.
const isTradeish = ({type}: IFormatTradeContext): boolean =>
	type === ETurnContextType.trade || type === ETurnContextType.chainReaction;

// Тот, чьей целью в обмене являюсь я, — то есть тот, кто отдаёт карту мне.
const giverTo = (context: IFormatTradeContext[] | null, viewerId: string): string | null =>
	find(filter(context ?? [], isTradeish), ({defensePlayerId}) => defensePlayerId === viewerId)?.offensePlayerId ?? null;

// Тот, кого целью выбрал я, — то есть тот, кому карту отдаю я.
const receiverFrom = (context: IFormatTradeContext[] | null, viewerId: string): string | null =>
	find(filter(context ?? [], isTradeish), ({offensePlayerId}) => offensePlayerId === viewerId)?.defensePlayerId ?? null;

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: IPlayersMap = {};
	@observable currentPlayerId : string | null = null;
	@observable playersList: string[] = [];
	// Чей сейчас ход. Стол наводит на него прицел (см. TurnReticle); по одному
	// turnState этого не понять — в обмене не в idle оба его участника.
	@observable turnPlayerId: string | null = null;
	// Куда идёт очередь хода. По кругу рассадки это направление роста индекса в
	// playersList, а на экране — по часовой (см. roomPlayerAngle): места
	// отсчитываются от нижнего через левое к верхнему. «Око за око» его
	// переворачивает, и стол показывает это стрелками на столешнице (см.
	// TableSurface).
	@observable isClockwise: boolean = true;
	@observable gameLog: IGameLogEntry[] = [];
	// Лог свёрнут по умолчанию: он перекрывает стол, а самое важное (текущее
	// действие) дублируется крупным индикатором.
	@observable isGameLogOpen: boolean = false;
	@observable deck: IDeckPayload = {count: 0, topCardType: ECardType.event};
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	// Стол развёрнут так, что ты сидишь внизу. По умолчанию выключено: стол
	// абсолютный, у всех одинаковый (см. roomPlayerOrder).
	@observable isFirstPersonTable: boolean = loadFirstPersonTable();
	@observable isFullScreen: boolean = false;
	@observable tradeContext: IFormatTradeContext[] | null = null;
	// Разовые применения карт (подсмотр, отказ от обмена и т.п.): стол рисует их
	// поверх бейджа игрока. Смотри IFormatCardEffect.
	@observable cardEffects: IFormatCardEffect[] = [];
	// Взятия карт из колоды: стол пускает по ним карту от колоды к игроку.
	// Смотри IFormatCardDraw и CardDraw.
	@observable cardDraws: IFormatCardDraw[] = [];
	// Карты, которые прямо сейчас приходят ко мне в руку и уходят из неё, вместе с
	// тем концом стола, откуда и куда они идут. Рука вводит и выводит их не «из
	// ниоткуда в никуда», а этим самым движением — одна карта, одна анимация.
	// Смотри markCardMoves и HandComponent.
	@observable arriving: ICardMove | null = null;
	@observable leaving: ICardMove | null = null;
	// Карта, которую я только что отдал в обмен, и кому: запомнена в момент
	// действия и ждёт того обновления, в котором она действительно уйдёт из руки.
	giving: ICardMove | null = null;
	// Номер последнего учтённого взятия. null — обновлений ещё не было.
	lastDrawSeq: number | null = null;
	// Сработавшая паника: лежит крупно в центре стола, пока идёт её событие (это
	// решает сервер) и пока не вышел panicCardMinMs. Смотри syncPanicCard.
	@observable panicCard: IFormatPanicCard | null = null;
	// Паника всё ещё идёт по мнению сервера.
	isPanicOnServer: boolean = false;
	// Минимум показа уже отсчитан.
	isPanicHoldOver: boolean = true;
	panicHoldTimer: ReturnType<typeof setTimeout> | null = null;
	// Нажатие по колоде, сделанное пока на столе лежала паника (см. cardPick).
	isCardPickDeferred: boolean = false;
	// Поле, а не константа: e2e опускает минимум, чтобы не ждать по пять секунд
	// на каждой панике (специальный спек проверяет настоящую выдержку).
	panicCardMinMs: number = panicCardHoldMs;
	@observable currentAction: INotificationAction | null = null;
	// Секунды до автоответа на текущий вопрос: их показывает кнопка по умолчанию
	// (см. startDecisionCountdown). null — отсчитывать нечего.
	@observable decisionSecondsLeft: number | null = null;
	decisionTimer: ReturnType<typeof setInterval> | null = null;
	@observable hand: IHandMap = {};
	@observable handActions: IHandActionsMap = {};
	@observable cardInPreview: string | null = null;
	@observable cardInNotificationPreview: string | null = null;
	// Карты, отмеченные галочкой в окне выбора нескольких карт (забывчивость):
	// ход уходит на сервер одним действием, когда отмечено ровно сколько просили.
	@observable checkedNotificationCards: string[] = [];
	@observable hostPlayerId: string = '';
	@observable isPlayerCanCancel: boolean = false;
	@observable isMenuOpen: boolean = false;
	// Живёт дольше самого уведомления о конце игры: игрок может его скрыть и
	// остаться дочитывать лог, но выход ему всё равно нужен — см. TableMenu.
	@observable isGameOver: boolean = false;
	// Конец игры, который ещё не показан. Сервер шлёт gameEnd перед последним
	// обновлением стола (Game.end), поэтому уведомление всегда придерживается до
	// него: только по обновлению видно, занялся ли на столе костёр. Смотри
	// syncGameEnd.
	pendingGameEnd: INotificationAction | null = null;
	gameEndTimer: ReturnType<typeof setTimeout> | null = null;
	// Наибольший номер уже виденного применения карты. null — обновлений ещё не
	// было: пришедшему в середину партии чужие костры разом не показывают.
	lastCardEffectSeq: number | null = null;
	// Сколько конец игры ждёт костёр: всё сожжение целиком и пауза после него.
	gameEndHoldMs: number = burnMs + burnTailMs;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
		// E2E handle: the Playwright per-card specs drive the game through this
		// controller (the same methods the canvas pointer handlers invoke) and
		// read its observable state. Exposing it is harmless in production.
		if (typeof window !== 'undefined') {
			(window as unknown as {__nechto?: GameController}).__nechto = this;
		}
		fscreen.addEventListener('fullscreenchange', () => {
			this.isFullScreen = !!fscreen.fullscreenElement
		});
	}

	@computed get currentPlayer(): Player | null {
		if (!this.currentPlayerId) return null;
		return this.players[this.currentPlayerId] || null;
	}


	kickPlayer = (playerId: string) => {
		this.socket.sendToServer(EClientEventType.kickPlayer, { playerId })
	};

	startGame = () => {
		this.socket.sendToServer(EClientEventType.startGame, {})
	};

	toggleReady = () => {
		this.socket.sendToServer(EClientEventType.toggleReadyGame, {})
	};

	cardAction = (actionType: EPlayerActionType, cardUniqueId: string) => {
		// Сброс слышит только сбросивший, и звучит он сразу по нажатию: на столе у
		// сброса нет ни анимации, ни события — что именно ушло в отбой, соседям
		// знать не положено (в логе просто «сбросил карту»).
		if (actionType === EPlayerActionType.cardDiscard) playDiscard();
		// Кому я отдаю карту, знаю только я сам — и знаю прямо сейчас, до всякого
		// ответа сервера. По его обновлениям это не восстановить: карта уходит из
		// руки раньше, чем в лог ложится строка о состоявшемся обмене (сервер
		// успевает разослать промежуточное обновление), а отказ «нет уж спасибо»
		// снаружи выглядит ровно так же, как отданная карта.
		this.giving = actionType === EPlayerActionType.cardTrade
			? {cardIds: [cardUniqueId], playerId: this.tradePartnerId()}
			: null;
		this.socket.sendToServer(EClientEventType.playerAction, {actionType, cardUniqueId})
	};

	// Второй участник обмена, который идёт прямо сейчас: если целью выбрали меня —
	// тот, кто выбрал, иначе тот, кого выбрал я.
	tradePartnerId = (): string | null => {
		const me = this.currentPlayerId;
		if (!me) return null;
		return giverTo(this.tradeContext, me) ?? receiverFrom(this.tradeContext, me);
	};

	activatePlayerSelectMode = (notification: INotificationAction) => {
		this.playersToSelect = notification.type === ENotificationAction.playerSelect
			? notification.playersToSelect
			: [];
		this.notifications = this.notifications.slice(1);
		// Закрытое окно с чужими картами — это подтверждение осмотра: пока оно
		// открыто, ход стоит и стол показывает стрелку с лупой (см. cardsView).
		if (notification.type === ENotificationAction.okayCard) this.confirmCardsView();
	};

	// Осмотр окончен. Сервер сам разберётся, ждал ли он подтверждения именно от
	// меня: окошком okayCard показывают и разовые вскрытия, ход не ждущие.
	confirmCardsView = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.viewConfirm});
	};

	selectNotificationCardPreview = (index: string) => {
		if (this.cardInNotificationPreview === index) {
			this.cardInNotificationPreview = null;
		} else {
			this.cardInNotificationPreview = index;
		}
	}

	// NOTE: reassign the observable array rather than mutating it (push/splice).
	// Under react-pixi-fiber, the Notifier observer only reliably re-renders on a
	// prop reassignment, not on in-place array mutation — see notifier.tsx.
	addNotification = (notification: INotificationAction) => {
		// Новое окно множественного выбора начинается с чистого листа: галочки
		// прошлого выбора (или брошенного окна) к его картам отношения не имеют.
		if (notification.type === ENotificationAction.selectCards) this.checkedNotificationCards = [];
		// Отсчёт до автоответа заводим по самому вопросу, а не по currentAction:
		// обновления стола приносят тот же вопрос заново, и отсчёт стартовал бы с
		// начала на каждом чужом действии.
		if (notification.type === ENotificationAction.actionDecision) this.startDecisionCountdown(notification.seconds);
		if (notification.type === ENotificationAction.gameEnd) {
			// Не показываем сразу: следом придёт последнее обновление стола, и по нему
			// станет видно, кончилась ли партия сожжением (см. syncGameEnd). Таймер —
			// на случай, если того обновления почему-то не будет: конец игры обязан
			// показаться в любом случае.
			this.pendingGameEnd = notification;
			this.armGameEndTimer(this.gameEndHoldMs);
			return;
		}
		this.notifications = [...this.notifications, notification];
	};

	// Сколько секунд осталось до того, как сервер нажмёт кнопку по умолчанию сам
	// (см. server/helpers/askDecision). null — вопроса с отсчётом сейчас нет.
	@action startDecisionCountdown = (seconds: number | undefined) => {
		this.stopDecisionCountdown();
		if (!seconds) return;
		this.decisionSecondsLeft = seconds;
		this.decisionTimer = setInterval(() => this.tickDecisionCountdown(), 1000);
	};

	@action tickDecisionCountdown = () => {
		if (this.decisionSecondsLeft === null) return;
		// На нуле замираем: закрыть окно — дело сервера, он же и отыграет ответ.
		this.decisionSecondsLeft = Math.max(0, this.decisionSecondsLeft - 1);
	};

	@action stopDecisionCountdown = () => {
		if (this.decisionTimer) clearInterval(this.decisionTimer);
		this.decisionTimer = null;
		this.decisionSecondsLeft = null;
	};

	// Конец игры ждёт, пока догорит костёр: сожжение — самая громкая сцена партии
	// и чаще всего сама же её развязка (сгорело Нечто). Окно поверх пожара съело
	// бы её целиком, поэтому сперва стол доигрывает огонь.
	@action syncGameEnd = (isBurnStarted: boolean) => {
		if (!this.pendingGameEnd) return;
		if (!isBurnStarted) {
			this.releaseGameEnd();
			return;
		}
		this.armGameEndTimer(this.gameEndHoldMs);
	};

	armGameEndTimer = (ms: number) => {
		if (this.gameEndTimer) clearTimeout(this.gameEndTimer);
		this.gameEndTimer = setTimeout(this.releaseGameEnd, ms);
	};

	@action releaseGameEnd = () => {
		if (this.gameEndTimer) clearTimeout(this.gameEndTimer);
		this.gameEndTimer = null;
		const notification = this.pendingGameEnd;
		if (!notification) return;
		this.pendingGameEnd = null;
		this.isGameOver = true;
		// Звук развязки — здесь, а не при получении уведомления: конец игры ждёт,
		// пока догорит костёр (см. gameEndHoldMs), и злодейский хохот посреди
		// пожара звучал бы победой раньше времени. Следом за ним встаёт тема.
		if (notification.type === ENotificationAction.gameEnd) playGameEnd(notification.isThingWin);
		// Обновлений стола после конца игры не будет, поэтому снять карту паники
		// сервер уже не попросит — снимаем сами, как только выйдет её выдержка.
		this.isPanicOnServer = false;
		this.hidePanicCardIfDone();
		this.notifications = [...this.notifications, notification];
	};

	toggleMenu = () => {
		this.isMenuOpen = !this.isMenuOpen;
	};

	closeMenu = () => {
		this.isMenuOpen = false;
	};

	hidENotificationAction = () => {
		this.notifications = this.notifications.slice(1);
	};

	// Отметка на карте в окне выбора. Повторное нажатие её снимает, а когда
	// набрано уже сколько просили, новая отметка вытесняет самую старую: иначе
	// передумавшему пришлось бы сперва искать и снимать лишнюю — а при выборе
	// одной карты отметку было бы вообще не переставить.
	@action toggleNotificationCardCheck = (cardUniqueId: string, limit: number) => {
		if (includes(this.checkedNotificationCards, cardUniqueId)) {
			this.checkedNotificationCards = without(this.checkedNotificationCards, cardUniqueId);
			return;
		}
		const checked = [...this.checkedNotificationCards, cardUniqueId];
		this.checkedNotificationCards = checked.slice(Math.max(0, checked.length - limit));
	};

	// Подтверждение всего выбора разом (кнопка OKEY).
	@action selectCards = (notification: INotificationAction) => {
		if (notification.type !== ENotificationAction.selectCards) return;
		if (this.checkedNotificationCards.length !== notification.count) return;
		this.socket.sendToServer(EClientEventType.playerAction, {
			actionType: EPlayerActionType.cardsSelect,
			cardUniqueIds: [...this.checkedNotificationCards],
		});
		this.checkedNotificationCards = [];
		this.hidENotificationAction();
	};

	selectPlayer = (playerId: string ) => {
		this.playersToSelect = [];
		// Запальник здесь не гасим, хотя целиться мне уже некуда: он горит для всего
		// стола и гаснуть должен у всех разом — по обновлению, а не на полобновления
		// раньше у одного меня.
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.playerSelect, selectedPlayerId: playerId});
	};

	cardPick = () => {
		// Пока на столе лежит карта паники, колода закрыта: сперва все читают, что
		// случилось (колода в это время и не подсвечена — см. Deck). Нажатие при
		// этом не теряем, а исполняем, как только карта уйдёт: иначе клик уходит в
		// пустоту и игрок (или бот) жмёт по мёртвой колоде.
		if (this.panicCard) {
			this.isCardPickDeferred = true;
			return;
		}
		this.isCardPickDeferred = false;
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardPick});
	}

	// Карта паники живёт на столе, пока идёт само событие — это решает сервер, —
	// но не меньше panicCardMinMs: мгновенные паники (вроде «старых верёвок»)
	// иначе мелькнули бы, и никто не понял бы, что произошло.
	@action syncPanicCard = (panicCard: IFormatPanicCard | null) => {
		const isNewPanic = !!panicCard && (!this.panicCard || panicCard.uniqueId !== this.panicCard.uniqueId);
		this.isPanicOnServer = !!panicCard;
		if (panicCard && isNewPanic) {
			this.panicCard = panicCard;
			playPanic();
			this.isPanicHoldOver = false;
			if (this.panicHoldTimer) clearTimeout(this.panicHoldTimer);
			this.panicHoldTimer = setTimeout(this.releasePanicCard, this.panicCardMinMs);
			return;
		}
		this.hidePanicCardIfDone();
	};

	@action releasePanicCard = () => {
		this.panicHoldTimer = null;
		this.isPanicHoldOver = true;
		this.hidePanicCardIfDone();
	};

	@action hidePanicCardIfDone = () => {
		if (this.isPanicOnServer || !this.isPanicHoldOver) return;
		this.panicCard = null;
		// Нажатие по закрытой колоде исполняем теперь — если брать карту всё ещё
		// нам (за время паники ход мог и уйти).
		if (!this.isCardPickDeferred) return;
		this.isCardPickDeferred = false;
		if (this.currentAction && this.currentAction.type === ENotificationAction.cardPick) this.cardPick();
	};

	actionDecision = (action: string ) => {
		this.hidENotificationAction();
		this.stopDecisionCountdown();
		switch (action) {
			case 'restart':
				this.isGameOver = false;
				this.isMenuOpen = false;
				this.root.state = EAppState.game;
				this.state = EGameState.lobby;
				return;
			case 'exit':
				// Через backToLauncher, а не просто сменой экрана: сервер должен узнать,
				// что игрок ушёл, иначе его сокет остаётся привязанным к мёртвой игре и
				// список комнат в лаунчере больше никогда не обновится.
				this.backToLauncher();
				return;
			case 'hide':
				// Уведомление скрыто, но игра всё равно закончена — выйти теперь можно
				// только через меню стола (isGameOver), поэтому флаг и не сбрасывается.
				return;
		}
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionDecision, action});
		this.hidENotificationAction();
	};

	toggleFirstPersonTable = () => {
		this.isFirstPersonTable = !this.isFirstPersonTable;
		saveFirstPersonTable(this.isFirstPersonTable);
	}

	toggleFullScreen = () => {
		if (!fscreen.fullscreenEnabled) return;
		if (!this.isFullScreen) {
			fscreen.requestFullscreen(document.getElementById("root"));
		} else {
			fscreen.exitFullscreen();
		}
	};

	// Откуда и куда в этом обновлении ходят МОИ карты. Считаем это здесь, потому
	// что только здесь ещё видны рука, контекст хода и лог ДО обновления: дальше
	// они уже перезаписаны, а рука должна знать ответ уже на первом кадре — её
	// переходы читают его в тот же миг, когда карта появляется и исчезает.
	//
	// Пришедшая карта: либо взята из колоды (сверяем событие взятия с сервера и
	// саму руку — если пришло не столько карт, сколько взято, какая из них какая
	// непонятно, и движение не назначаем), либо получена от другого игрока.
	// Ушедшая: отдана другому игроку. Сброс и разыгранная карта сюда не попадают —
	// им лететь некуда, они просто уходят из руки.
	markCardMoves = (
		{cardDraws, viewerId, newHand}:
		{cardDraws: IFormatCardDraw[], viewerId: string, newHand: IHandMap},
	) => {
		const latestSeq = reduce(cardDraws, (acc: number, {seq}) => Math.max(acc, seq), 0);
		const seenSeq = this.lastDrawSeq;
		const freshDraws = seenSeq === null ? [] : filter(cardDraws, ({seq}) => seq > seenSeq);
		this.lastDrawSeq = latestSeq;
		// Первое обновление — это вход в игру: вся рука «новая», но прилетать ей
		// неоткуда. Так же и переподключившийся не догоняет чужие ходы разом.
		if (seenSeq === null) {
			this.arriving = null;
			this.leaving = null;
			return;
		}

		const prevContext = this.tradeContext;
		const prevHand = keys(this.hand);
		const arrived = difference(keys(newHand), prevHand);
		const left = difference(prevHand, keys(newHand));

		// Отметки переписываем ТОЛЬКО когда карта и правда сдвинулась. Один ход
		// сервер нередко рассылает двумя обновлениями подряд (карта уходит из руки в
		// первом, ответная приходит во втором), и обнуление на каждом обновлении
		// стирало бы отметку раньше, чем её прочитает стол: тот сверяется с ней,
		// чтобы не нарисовать второй, свой полёт поверх того, что делает рука.
		if (arrived.length) {
			const drawnCount = reduce(freshDraws, (acc: number, {playerId, count}) => acc + (playerId === viewerId ? count : 0), 0);
			if (drawnCount > 0) {
				this.arriving = arrived.length === drawnCount ? {cardIds: arrived, playerId: null} : null;
			} else if (arrived.length === 1) {
				// Кто мне отдал: тот, чьей целью я был, а если целью был не я, то тот,
				// кого целью выбрал я — так возвращается своя карта после отказа и так
				// приходит ответная карта состоявшегося обмена.
				const from = giverTo(prevContext, viewerId) ?? receiverFrom(prevContext, viewerId);
				this.arriving = from ? {cardIds: arrived, playerId: from} : null;
			} else {
				this.arriving = null;
			}
		}

		if (left.length) {
			// Отданная карта — та самая, которую я отдал сам (см. cardAction), и ровно
			// в том обновлении, в котором она наконец ушла из руки. Всё остальное
			// (сброс, разыгранная карта) просто уходит из руки: лететь ему некуда.
			const giving = this.giving;
			const isGiven = !!giving && !!giving.playerId && every(giving.cardIds, id => includes(left, id));
			this.leaving = isGiven ? giving : null;
			if (isGiven) this.giving = null;
		}
	};

	updateHand = (newHand: IHandMap) => {
		each(this.hand, card => {
			if (card.uniqueId && !newHand[card.uniqueId]) delete this.hand[card.uniqueId]
		});
		merge(this.hand, newHand)
	};

	updatePlayers = (newPlayers: IPlayersMap) => {
		merge(this.players, newPlayers);
		each(this.players, (player) => {
			if (player && !newPlayers[player.id]) {
				delete this.players[player.id];
			}
		})
	};

	updateHandActions = (handActions: IHandActionsMap) => {
		this.handActions = handActions
	};

	// Одним действием: без него mobx отдаёт реакциям каждое присваивание по
	// отдельности, и компонент успевает отрисоваться с новым контекстом хода, но
	// ещё старой рукой и логом — а анимация обмена сверяет ровно их между собой.
	@action updateGame = ({tradeContext, cardEffects, cardDraws, panicCard, players, playersList, turnPlayerId, isClockwise, deck, gameLog, currentAction, state, currentPlayer, hand, handActions, hostPlayerId, isPlayerCanCancel}: IGameUpdatePayload) => {
		this.updatePlayers(players);
		this.markCardMoves({cardDraws, viewerId: currentPlayer.id, newHand: hand});
		this.updateHand(hand);
		this.updateHandActions(handActions);
		this.hostPlayerId = hostPlayerId;
		this.syncSeating(playersList);
		this.playersList = playersList;
		this.turnPlayerId = turnPlayerId;
		this.isClockwise = isClockwise ?? true;
		this.deck = deck;
		this.isPlayerCanCancel = isPlayerCanCancel;
		this.currentPlayerId = currentPlayer.id;
		this.tradeContext = tradeContext;
		this.syncAiming(tradeContext ?? null);
		this.cardEffects = cardEffects;
		this.cardDraws = cardDraws;
		this.syncPanicCard(panicCard);
		this.currentAction = currentAction;
		// Вопрос закрыт (ответили сами или за нас) — отсчитывать больше нечего.
		if (!currentAction || currentAction.type !== ENotificationAction.actionDecision) this.stopDecisionCountdown();
		// Партия началась — тема замолкает. Обычно её снимает событие начала игры
		// (см. socketController), но пришедшему в партию заново его уже не пришлют:
		// перезагрузивший вкладку узнаёт о идущей игре только отсюда, первым же
		// обновлением. На развязке тема встаёт обратно, и обновления после неё её не
		// трогают: партия к этому моменту уже была начата, перехода нет.
		if (state === EGameState.sarted && this.state !== EGameState.sarted) stopMusic();
		this.state = state;
		this.gameLog = gameLog;
		this.syncGameEnd(this.takeBurnStarted(cardEffects));
	};

	// Пересадка звучит там, где игроки действительно меняются местами, — а не там,
	// где разыграна карта. Причина в том, что пересаживает не только рука:
	// «Меняемся местами!» и «Сматывай удочки!» ходят с руки, а «Раз, два...» и
	// «И это вы называете вечеринкой?» приходят паникой из колоды — своей карты на
	// столе у них нет, и звук им взять больше неоткуда. За столом же во всех этих
	// случаях происходит одно и то же, и слышаться это должно одинаково.
	//
	// Признак пересадки — тот же состав в другом порядке. Именно оба условия:
	// список меняется и когда игрок выбыл или вышел, но это не пересадка, и
	// звучать ей незачем.
	syncSeating = (playersList: string[]) => {
		const seated = this.playersList;
		// Стол ещё не собран (первое обновление) или партия только началась: то, что
		// рассадка отличается от лобби, — не пересадка, а раздача мест.
		if (this.state !== EGameState.sarted || seated.length !== playersList.length) return;
		if (difference(seated, playersList).length) return;
		if (every(playersList, (playerId, index) => playerId === seated[index])) return;
		playMove();
	};

	// Огнемёт на изготове: пока кто-то за столом выбирает, кого сжечь, у ствола
	// горит запальник (см. helpers/pilotFlame). Слышат его все — это звук стола, а
	// не подсказка целящемуся: огнемёт достали при всех, и ждать выстрела всем.
	//
	// Признак — контекст хода, а не вопрос игрока: вопрос сервер шлёт одному
	// целящемуся, а контекст приходит в обновлении всем. Прицеливание в нём — это
	// сожжение без цели: цель появится, когда её выберут, и запальник погаснет.
	//
	// Смотрим на каждое обновление, а не только на его начало: тем же контекстом
	// видно и что прицеливание кончилось — выбрали, отменили или сервер закрыл его
	// сам. Пришедший в игру заново (перезагрузил вкладку) получает контекст в
	// первом же обновлении, и запальник у него зазвучит там же, где звучал.
	syncAiming = (tradeContext: IFormatTradeContext[] | null) => {
		const isAiming = some(tradeContext, ({type, cardId, defensePlayerId}) =>
			type === ETurnContextType.burn && cardId === EEventID.flamethrower && !defensePlayerId);
		if (isAiming) startPilotFlame();
		else stopPilotFlame();
	};

	// Занялся ли в этом обновлении костёр — тем же признаком, каким его поджигает
	// стол (см. useBurns): свежее применение огнемёта с целью.
	takeBurnStarted = (cardEffects: IFormatCardEffect[]): boolean => {
		const seen = this.lastCardEffectSeq;
		const latest = reduce(cardEffects, (acc: number, {seq}) => Math.max(acc, seq), 0);
		this.lastCardEffectSeq = latest;
		// Обновлений ещё не было или счёт пошёл заново (следующая партия) — догонять
		// нечего.
		if (seen === null || latest < seen) return false;
		return some(cardEffects, ({seq, cardId, targetPlayerId}) =>
			seq > seen && cardId === EEventID.flamethrower && !!targetPlayerId);
	};

	toggleGameLog = () => {
		this.isGameLogOpen = !this.isGameLogOpen;
	};

	backToLauncher = () => {
		this.socket.sendToServer(EClientEventType.leaveGame, {})
		// Со стола уходят — значит партии для этого игрока больше нет, и тема
		// возвращается на лобби. Уже играющую (ушли после развязки) startMusic не
		// перебивает. Запальник, наоборот, гасим: обновлений, по которым он гаснет
		// сам, для этого стола больше не будет.
		startMusic();
		stopPilotFlame();
		// Чистим экранное состояние стола: иначе следующая игра открывается с чужими
		// уведомлениями и старым индикатором действия.
		this.isMenuOpen = false;
		this.isGameOver = false;
		if (this.gameEndTimer) clearTimeout(this.gameEndTimer);
		this.gameEndTimer = null;
		this.pendingGameEnd = null;
		this.lastCardEffectSeq = null;
		this.notifications = [];
		this.currentAction = null;
		this.stopDecisionCountdown();
		this.playersToSelect = [];
		this.checkedNotificationCards = [];
		if (this.panicHoldTimer) clearTimeout(this.panicHoldTimer);
		this.panicHoldTimer = null;
		this.isPanicOnServer = false;
		this.isPanicHoldOver = true;
		this.panicCard = null;
		this.isCardPickDeferred = false;
		// Следующая игра начинается со своего счёта взятий, и рука в ней раздаётся,
		// а не прилетает из колоды.
		this.arriving = null;
		this.leaving = null;
		this.giving = null;
		this.lastDrawSeq = null;
		this.state = EGameState.lobby;
		this.root.launcherController.state = EAsyncState.idle;
		this.root.state = EAppState.launcher;
	}

	actionCancel = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionCancel});
	}

	changePlayerMark = (playerId: string) => {
		this.socket.sendToServer(EClientEventType.markPlayer, {playerId});
	}
}
