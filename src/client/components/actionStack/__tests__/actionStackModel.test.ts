import {describe, expect, test} from 'bun:test';
import {EGameLogType} from 'shared/enum/gameLogType';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';
import {
	getActionIcon,
	getEntryCardId,
	getStackEntries,
	getStackGeometry,
} from 'client/components/actionStack/actionStackModel';

// Стек действий строится из того же лога, что раньше читался строками: одна
// карточка — один законченный шаг. Здесь проверяется ровно это склеивание: что
// на карточке окажется, что уедет к ней в подсказку, а что не окажется вовсе.

const entry = (type: EGameLogType, text: string): IGameLogEntry => ({type, text});

const shape = (log: IGameLogEntry[]) => getStackEntries(log)
	.map((item) => [item.entry.text, ...item.details].join(' | '));

describe('карточки стека действий', () => {
	test('сид уезжает в подсказку к старту игры', () => {
		expect(shape([
			entry(EGameLogType.system, 'Сид игры: 42'),
			entry(EGameLogType.system, 'Игра началась'),
		])).toEqual(['Игра началась | Сид игры: 42']);
	});

	test('паника и то, что она делает, — одна карточка', () => {
		expect(shape([
			entry(EGameLogType.panic, 'Игрок Bob достает карту паники «Забывчивость»'),
			entry(EGameLogType.panic, 'Паника! Забывчивость: Игрок меняет три карты с руки на три из колоды'),
		])).toEqual(['Игрок Bob достает карту паники «Забывчивость» | Паника! Забывчивость: Игрок меняет три карты с руки на три из колоды']);
	});

	test('но исход паники — уже отдельный шаг', () => {
		// Кто с кем в итоге поменялся местами, на карте паники не написано.
		expect(shape([
			entry(EGameLogType.panic, 'Игрок Bob достает карту паники «...раз, два...»'),
			entry(EGameLogType.panic, 'Паника: раз-два игрок Bob меняется местами с третьим игроком'),
			entry(EGameLogType.panic, 'Игрок Bob меняется местами с Alice'),
		])).toEqual([
			'Игрок Bob достает карту паники «...раз, два...» | Паника: раз-два игрок Bob меняется местами с третьим игроком',
			'Игрок Bob меняется местами с Alice',
		]);
	});

	test('смена хода в стек не попадает', () => {
		expect(shape([
			entry(EGameLogType.turn, 'Ходит игрок Bob!'),
			entry(EGameLogType.deck, 'Игрок Bob берет карту из колоды и ходит...'),
		])).toEqual(['Игрок Bob берет карту из колоды и ходит...']);
	});

	test('номер карточки — её место в полном логе, а не в стеке', () => {
		// По нему React узнаёт карточку между обновлениями: пропуски в номерах —
		// это как раз склеенные и выброшенные строки.
		expect(getStackEntries([
			entry(EGameLogType.system, 'Сид игры: 42'),
			entry(EGameLogType.system, 'Игра началась'),
			entry(EGameLogType.turn, 'Ходит игрок Bob!'),
			entry(EGameLogType.deck, 'Игрок Bob берет карту из колоды'),
		]).map((item) => item.id)).toEqual([1, 3]);
	});
});

describe('картинка карты на карточке стека', () => {
	test('разыгранная карта — по названию в строке', () => {
		expect(getEntryCardId(entry(EGameLogType.card, 'Игрок Bob играет карту "Топор" на Alice'))).toBe('axe');
		expect(getEntryCardId(entry(EGameLogType.panic, 'Игрок Bob достает карту паники «Забывчивость»')))
			.toBe('forgetfulness');
	});

	test('чужая колода не годится: паника не показывается дверью', () => {
		// «Три, четыре» в своём тексте себя не называет — названа там только дверь,
		// а она из колоды событий, значит картинки у карточки не будет.
		expect(getEntryCardId(entry(EGameLogType.panic, 'Паника Все карты "Заколоченная дверь" сбрасываются')))
			.toBeUndefined();
		// А «Старые верёвки» себя называют — карантин в той же строке их не сбивает.
		expect(getEntryCardId(entry(EGameLogType.panic, 'Паника старые веревки. Все карты "Карантин" сбрасываются')))
			.toBe('oldRopes');
	});

	test('из нескольких названий берётся первое — разыгранная карта, а не последствия', () => {
		// Виски раскрывает руку, поэтому в строке названы ещё и все карты в ней.
		expect(getEntryCardId(entry(
			EGameLogType.card,
			'Bob играет «Виски»: я слишком пьян для этого дерьма! Вот мои карты: «Упорство», «Заражение!»',
		))).toBe('whiskey');
	});

	test('тип строки не мешает: карту показывает и защита, и карантин', () => {
		expect(getEntryCardId(entry(EGameLogType.quarantine, 'Игрок Alice теперь на карантине'))).toBe('quarantine');
		expect(getEntryCardId(entry(EGameLogType.defense, 'Bob: используя карту Страх отказывается от обмена')))
			.toBe('fear');
	});

	test('пропуск шага из-за карантина или двери — не розыгрыш карты', () => {
		// Карта в строке названа, но никто её не играл: она просто стоит и мешает.
		// Картинка читалась бы как «её только что сыграли».
		const blocked = [
			entry(EGameLogType.quarantine, 'Игрок Bob не меняется из-за карантина'),
			entry(EGameLogType.quarantine, 'Игрок Bob не может меняться картой, т.к он на карантине. Торговля отменяется.'),
			entry(EGameLogType.trade, 'Игрок Bob не меняется из-за заколоченной двери'),
		];
		for (const item of blocked) {
			expect(getEntryCardId(item)).toBeUndefined();
			expect(getActionIcon(item)).toBe('🚫');
		}
		// А выход из карантина — это про саму карту, её и показываем.
		expect(getEntryCardId(entry(EGameLogType.quarantine, 'Игрок Bob вышел из карантина'))).toBe('quarantine');
	});

	test('строка без названия карты остаётся знаком типа', () => {
		expect(getEntryCardId(entry(EGameLogType.trade, 'Игроки Bob и Alice меняются картами'))).toBeUndefined();
		expect(getEntryCardId(entry(EGameLogType.deck, 'Игрок Bob берет карту из колоды'))).toBeUndefined();
		expect(getEntryCardId(entry(EGameLogType.death, 'Игрок Bob был заживо сожжен игроком Alice'))).toBeUndefined();
	});
});

describe('знак на карточке', () => {
	test('состоявшийся обмен отличается от начатого', () => {
		// Обе строки — тип trade, и лежат они в стеке рядом.
		const started = getActionIcon(entry(EGameLogType.trade, 'Игроки Bob и Alice меняются картами'));
		const done = getActionIcon(entry(EGameLogType.trade, 'Игроки Alice и Bob обменялись картами'));
		expect(done).not.toBe(started);
	});

	test('сброс, смена мест и обычная карта различаются знаками', () => {
		const icons = [
			'Игрок Bob сбросил карту',
			'Игроки Bob и Alice меняются местами',
			'Игрок Bob играет карту',
		].map((text) => getActionIcon(entry(EGameLogType.card, text)));
		expect(new Set(icons).size).toBe(icons.length);
	});
});

describe('раскладка стека', () => {
	test('карточки всегда лежат внахлёст', () => {
		const wide = getStackGeometry(500, 5);
		expect(wide.step).toBeLessThan(wide.cardWidth);
		expect(wide.trackWidth).toBeLessThanOrEqual(500);
	});

	test('стек любой глубины помещается в отведённую полосу', () => {
		for (const capacity of [1, 4, 6, 9, 12]) {
			for (const available of [280, 380, 500]) {
				const geometry = getStackGeometry(available, capacity);
				expect(geometry.trackWidth).toBeLessThanOrEqual(available + 0.001);
				expect(geometry.cardWidth).toBeGreaterThan(0);
			}
		}
	});
});
