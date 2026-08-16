import type {CSSProperties} from 'react';
import {compact, each, find, map, values} from 'lodash';
import {EPanicID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';
import type GameController from 'client/controllers/gameController';
import {splitCardMentions} from 'client/components/hint/cardMentions';

// Стек действий: одна законченная вещь на столе — одна карточка. Тип строки лога
// и есть её «лицо»: по нему выбирается иконка, цвет и подпись в подсказке.

// Иконки взяты из словаря стрелок на столе (см. Room/getArrowEmoji), чтобы обмен
// в стеке и обмен между кружками читались одним и тем же знаком.
export const ACTION_ICONS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: '⚙',
	[EGameLogType.turn]: '▶',
	[EGameLogType.deck]: '📥',
	[EGameLogType.card]: '🃏',
	[EGameLogType.panic]: '⚡',
	[EGameLogType.trade]: '🤝',
	[EGameLogType.defense]: '🛡',
	[EGameLogType.quarantine]: '☣',
	[EGameLogType.death]: '💀',
	[EGameLogType.info]: '•',
};

// Подпись в шапке подсказки: одним словом, что это было.
export const ACTION_LABELS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: 'Служебное',
	[EGameLogType.turn]: 'Ход',
	[EGameLogType.deck]: 'Колода',
	[EGameLogType.card]: 'Карта',
	[EGameLogType.panic]: 'Паника',
	[EGameLogType.trade]: 'Обмен',
	[EGameLogType.defense]: 'Защита',
	[EGameLogType.quarantine]: 'Карантин',
	[EGameLogType.death]: 'Смерть',
	[EGameLogType.info]: 'Событие',
};

// Ровно шесть шестнадцатеричных цифр: к цвету дописывается прозрачность (см.
// getActionColors), поэтому короткая запись здесь не годится.
export const ACTION_COLORS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: '#8a97a0',
	[EGameLogType.turn]: '#5ec8f0',
	[EGameLogType.deck]: '#5c8f3f',
	[EGameLogType.card]: '#4ecdc4',
	[EGameLogType.panic]: '#ff7f2a',
	[EGameLogType.trade]: '#ffd93d',
	[EGameLogType.defense]: '#a29bfe',
	[EGameLogType.quarantine]: '#c2f04a',
	[EGameLogType.death]: '#ff5252',
	[EGameLogType.info]: '#7a8288',
};

// Одним типом сервер пишет разные шаги, и в стеке они лежат рядом — знак должен
// их различать. Правила проверяются по порядку, первое подошедшее и выигрывает.
const ICON_OVERRIDES: {type?: EGameLogType, match: string, icon: string}[] = [
	// Обмен идёт двумя строками: «меняются картами» — начался, «обменялись
	// картами» — дошёл до конца.
	{type: EGameLogType.trade, match: 'обменялись', icon: '👌'},
	{type: EGameLogType.card, match: 'сбросил карту', icon: '🗑'},
	// Смена мест: и та, что состоялась по карте, и та, что устроила паника.
	{match: 'местами', icon: '🔄'},
];

export const getActionType = (entry: IGameLogEntry): EGameLogType => entry.type || EGameLogType.info;

export const getActionIcon = (entry: IGameLogEntry): string => {
	const type = getActionType(entry);
	const override = find(
		ICON_OVERRIDES,
		(rule) => (!rule.type || rule.type === type) && entry.text.includes(rule.match),
	);
	return override ? override.icon : (ACTION_ICONS[type] || ACTION_ICONS[EGameLogType.info]);
};

export const getActionColors = (type: EGameLogType) => {
	const color = ACTION_COLORS[type] || ACTION_COLORS[EGameLogType.info];
	return {
		'--action-color': color,
		'--action-edge': `${color}8c`,
		'--action-glow': `${color}55`,
		'--action-tint': `${color}38`,
	} as CSSProperties;
};

const PANIC_IDS = new Set<string>(values(EPanicID));

// Картинку карты на карточку действия ставим по первому названию из подходящей
// колоды: разыгранную карту сервер называет в начале строки, а всё, что дальше,
// — уже последствия («Bob играет «Виски»: вот мои карты: …»).
//
// Колода и решает, верить ли названию вообще: «Паника: все карты "Заколоченная
// дверь" сбрасываются» называет карту событий, значит саму панику («Три,
// четыре») она не называет — такая карточка остаётся со знаком типа.
export const getEntryCardId = (entry: IGameLogEntry): string | undefined => {
	const type = getActionType(entry);
	if (type !== EGameLogType.card && type !== EGameLogType.panic) return undefined;
	const isPanic = type === EGameLogType.panic;
	return find(
		compact(map(splitCardMentions(entry.text), 'cardId')),
		(cardId) => PANIC_IDS.has(cardId) === isPanic,
	);
};

// Строка, которой сервер объявляет вытянутую панику (см. panicAction). Сразу за
// ней паника рассказывает, что именно она делает («Паника! Забывчивость: игрок
// меняет три карты…»). Отдельной карточки это не заслуживает — это та же самая
// паника, — поэтому строка уезжает в подсказку к её карточке. Всё, что паника
// логирует ДАЛЬШЕ (кто с кем в итоге поменялся местами), — уже отдельный шаг.
const PANIC_DRAW = 'достает карту паники';

// Сид пишется отдельной строкой прямо перед «Игра началась» (см. Game.start) —
// это одно событие, разбитое надвое, поэтому сид уезжает в подсказку к старту
// игры, а не занимает собой первую карточку стека.
const GAME_SEED = 'Сид игры';

export interface IStackEntry {
	// Номер строки в полном логе: он только растёт, поэтому карточка не меняет
	// личность, пока стек сдвигается под ней.
	id: number;
	entry: IGameLogEntry;
	// Приклеенные к карточке строки: показываются в подсказке под основной.
	details: string[];
}

export const getStackEntries = (gameLog: IGameLogEntry[]): IStackEntry[] => {
	const entries: IStackEntry[] = [];
	// Строки, ждущие своей карточки: они пишутся раньше события, к которому
	// относятся (сид — перед стартом игры).
	let pending: string[] = [];
	each(gameLog, (entry, index) => {
		// «Ходит игрок X» — не действие, а разметка круга: чей ход, и так видно по
		// прицелу на столе. В стеке эта строка только съедала бы место.
		if (getActionType(entry) === EGameLogType.turn) return;
		if (entry.text.startsWith(GAME_SEED)) {
			pending.push(entry.text);
			return;
		}
		const previous = index > 0 ? gameLog[index - 1] : undefined;
		const last = entries.length ? entries[entries.length - 1] : undefined;
		const isPanicEffect = getActionType(entry) === EGameLogType.panic
			&& !!previous
			&& getActionType(previous) === EGameLogType.panic
			&& previous.text.includes(PANIC_DRAW);
		if (isPanicEffect && last) {
			last.details.push(entry.text);
			return;
		}
		entries.push({id: index, entry, details: pending});
		pending = [];
	});
	return entries;
};

// Живых игроков (без дверей и мертвецов) — столько карточек в стеке и держим.
// Правило то же, что было у лога: шагов видно ровно на круг стола.
export const getStackCapacity = (controller: GameController): number => {
	let count = 0;
	each(controller.players, (player) => {
		if (!player) return;
		if (player.state === EPlayerState.door) return;
		if (player.turnState === ETurnState.dead) return;
		count++;
	});
	return Math.max(count, 1);
};

export interface IStackGeometry {
	cardWidth: number;
	cardHeight: number;
	// Шаг между соседними карточками. Меньше ширины — значит они лежат внахлёст.
	step: number;
	trackWidth: number;
}

const CARD_RATIO = 1.46;
const MAX_CARD_WIDTH = 52;
const MIN_CARD_WIDTH = 24;
// Карточки всегда лежат стопкой — слегка друг на друге, а не в ряд с зазором.
const STEP_SHARE = 0.8;
// Глубже половины карточки не наезжаем: под иконку нужно место (см. --action-sliver).
const MIN_STEP_SHARE = 0.5;

export const getStackGeometry = (available: number, capacity: number): IStackGeometry => {
	const slots = Math.max(capacity, 1);
	const fit = (cardWidth: number, share: number): IStackGeometry => ({
		cardWidth,
		cardHeight: Math.round(cardWidth * CARD_RATIO),
		step: cardWidth * share,
		trackWidth: (slots - 1) * cardWidth * share + cardWidth,
	});
	const loose = fit(MAX_CARD_WIDTH, STEP_SHARE);
	if (slots === 1 || loose.trackWidth <= available) return loose;
	// Тесно: наезжают сильнее, но не глубже половины карточки.
	const share = Math.max(MIN_STEP_SHARE, (available - MAX_CARD_WIDTH) / ((slots - 1) * MAX_CARD_WIDTH));
	const packed = fit(MAX_CARD_WIDTH, share);
	if (packed.trackWidth <= available) return packed;
	// Совсем тесно: нахлёст уже предельный, уменьшаем сами карточки.
	const cardWidth = Math.max(MIN_CARD_WIDTH, available / (MIN_STEP_SHARE * (slots - 1) + 1));
	return fit(cardWidth, MIN_STEP_SHARE);
};
