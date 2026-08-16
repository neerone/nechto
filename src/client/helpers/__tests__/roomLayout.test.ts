import {describe, expect, test, beforeAll} from 'bun:test';
import {map, range} from 'lodash';

// Геометрия стола считается от размеров окна, поэтому перед импортом хелперов
// подсовываем минимальный window: viewport читает его прямо в конструкторе.
const fakeWindow = {
	innerWidth: 1280,
	innerHeight: 720,
	devicePixelRatio: 1,
	addEventListener: () => {},
	removeEventListener: () => {},
	requestAnimationFrame: () => 0,
	cancelAnimationFrame: () => {},
};
(globalThis as unknown as {window: typeof fakeWindow}).window = fakeWindow;

let viewport: typeof import('client/helpers/viewport').viewport;
let roomRadii: typeof import('client/helpers/roomHelpers').roomRadii;
let tableRadii: typeof import('client/helpers/roomHelpers').tableRadii;
let tableLift: typeof import('client/helpers/roomHelpers').tableLift;
let tableCardPoint: typeof import('client/helpers/roomHelpers').tableCardPoint;
let deckCardWidth: typeof import('client/helpers/roomHelpers').deckCardWidth;
let playerRoomDiag: typeof import('client/helpers/roomHelpers').playerRoomDiag;
let roomPlayerOrder: typeof import('client/helpers/roomHelpers').roomPlayerOrder;
let roomPlayerPoint: typeof import('client/helpers/roomHelpers').roomPlayerPoint;
let isFarSeat: typeof import('client/helpers/roomHelpers').isFarSeat;
let unwrapAngle: typeof import('client/helpers/roomHelpers').unwrapAngle;
let tableSquash: number;
let tableTopSquash: number;
let badgeAspect: number;
let tableField: typeof import('client/helpers/window').tableField;
let tableCenterY: typeof import('client/helpers/window').tableCenterY;

beforeAll(async () => {
	({viewport} = await import('client/helpers/viewport'));
	({
		roomRadii, tableRadii, tableLift, tableCardPoint, deckCardWidth, playerRoomDiag, roomPlayerOrder, roomPlayerPoint,
		isFarSeat, unwrapAngle, tableSquash, tableTopSquash, badgeAspect,
	} = await import('client/helpers/roomHelpers'));
	({tableField, tableCenterY} = await import('client/helpers/window'));
});

const resize = (width: number, height: number) => {
	fakeWindow.innerWidth = width;
	fakeWindow.innerHeight = height;
	viewport.measure();
};

// Ходовые форматы: десктоп, ультравайд, ноутбук, планшет, телефоны в обеих
// ориентациях и совсем маленький экран.
const screens = [
	{name: 'desktop 1920x1080', width: 1920, height: 1080},
	{name: 'desktop 1492x1046', width: 1492, height: 1046},
	{name: 'laptop 1366x768', width: 1366, height: 768},
	{name: 'ultrawide 2560x1080', width: 2560, height: 1080},
	{name: 'ipad 820x1180', width: 820, height: 1180},
	{name: 'phone 563x1020', width: 563, height: 1020},
	{name: 'iphone 390x844', width: 390, height: 844},
	{name: 'small phone 320x568', width: 320, height: 568},
	{name: 'phone landscape 844x390', width: 844, height: 390},
];

const counts = [4, 5, 6, 8, 10, 12];

describe('геометрия стола', () => {
	for (const screen of screens) {
		for (const count of counts) {
			const label = `${screen.name}, ${count} игроков`;

			test(`${label}: круг рассадки в проекции, бейджи крупные и не наезжают`, () => {
				resize(screen.width, screen.height);
				const badge = playerRoomDiag(count);
				const badgeHeight = badge * badgeAspect;
				const {rx, ry} = roomRadii(count);
				const field = tableField();

				// Круг рассадки — круг, увиденный из-за края стола: на экране это
				// эллипс ровно с той сплюснутостью, с какой нарисована столешница.
				expect(ry / rx).toBeCloseTo(tableSquash, 6);

				// Бейдж — палец, а не точка: 40 px это минимум для тача, и держится он
				// на любом экране при любом столе.
				const isTiny = Math.min(screen.width, screen.height) < 400;
				expect(badge).toBeGreaterThanOrEqual(40);

				// Соседние бейджи стоят почти вплотную, но не сливаются: у боков стола,
				// где сплюснутый круг уходит вглубь, им позволено слегка заходить друг
				// за друга — это и есть глубина (см. badgeGap). Считаем по самой
				// рассадке, а не по формуле эллипса: ближние места ещё и стянуты к
				// нижнему (см. nearSeatPull).
				const seats = map(range(count), String);
				const points = map(seats, (playerId) => roomPlayerPoint(playerId, seats));
				const gaps = map(points, ({x, y}, index) => {
					const next = points[(index + 1) % count]!;
					return Math.hypot(next.x - x, next.y - y);
				});
				// Полный стол на крошечном экране — вырожденный случай: там кольцо всего
				// в полторы сотни пикселей высотой, и десять человек по нему иначе как
				// внахлёст не расставить. Кружок при этом остаётся кнопкой (см. выше), а
				// перекрытие — глубиной.
				const crowded = isTiny && count >= 10;
				expect(Math.min(...gaps)).toBeGreaterThanOrEqual(badge * (crowded ? 0.5 : 1));

				// Стол вместе с бейджами влезает в свободное поле. По вертикали бейдж
				// занимает больше: он вытянут.
				expect(rx + badge / 2).toBeLessThanOrEqual(field.width / 2);
				expect(ry + badgeHeight / 2).toBeLessThanOrEqual(field.height / 2 + 0.001);

				// И не залезает ни под лог сверху, ни под руку снизу.
				const center = tableCenterY();
				expect(center - ry - badgeHeight / 2).toBeGreaterThanOrEqual(field.top);
				expect(center + ry + badgeHeight / 2).toBeLessThanOrEqual(field.bottom + 0.001);
			});

			test(`${label}: столешница внутри круга рассадки, колода на ней`, () => {
				resize(screen.width, screen.height);
				const badge = playerRoomDiag(count);
				const {rx, ry} = roomRadii(count);
				const surface = tableRadii(count);

				// Столешница вписана в круг рассадки: игроки сидят вокруг неё, а не на
				// ней. Лежит она положе пола — она поднята над ним, и смотрим мы на неё
				// под более пологим углом (см. tableTopSquash).
				expect(surface.ry / surface.rx).toBeCloseTo(tableTopSquash, 6);
				expect(tableTopSquash).toBeLessThan(tableSquash);
				expect(surface.rx).toBeLessThan(rx);

				// Дальних она подрезает, но не съедает целиком: их кружки должны
				// оставаться узнаваемыми. Считаем по ПОДНЯТОЙ крышке: стол стоит на
				// полу, и дальнего он режет своим дальним краем, а тот выше середины
				// комнаты ровно на высоту стола.
				const hidden = badge * badgeAspect / 2 - (ry - surface.ry - tableLift(count));
				expect(hidden).toBeGreaterThan(0);
				expect(hidden).toBeLessThan(badge * badgeAspect * 0.45);

				// И не отходит от ближних: край столешницы должен доставать им до груди,
				// иначе они сидят не за столом, а поодаль от него.
				const nearEdge = surface.ry - tableLift(count);
				const nearChest = ry - (badge * badgeAspect) / 2;
				expect(nearEdge).toBeGreaterThanOrEqual(nearChest - badge * 0.25);

				// Колода лежит на столешнице, а не свисает с неё. Лежит — то есть в
				// проекции столешницы: по вертикали она сжата тем же tableTopSquash.
				const deck = deckCardWidth(count);
				expect(deck / 2).toBeLessThanOrEqual(surface.rx);
				expect((deck * 1.46 * tableTopSquash) / 2).toBeLessThanOrEqual(surface.ry);
			});

			test(`${label}: стол стоит на полу, а карты лежат на его крышке`, () => {
				resize(screen.width, screen.height);
				const {rx, ry} = roomRadii(count);
				const surface = tableRadii(count);
				const lift = tableLift(count);
				const badgeHeight = playerRoomDiag(count) * badgeAspect;

				// Высота стола — это высота стола: она отмеряется от комнаты и на любом
				// экране составляет одну и ту же её долю. Прибитая к пикселям (а так
				// она и была подобрана на глаз) она на телефоне складывала бы стол
				// вдвое, а на большом экране терялась.
				expect(lift / rx).toBeCloseTo(tableLift(count) / rx, 12);
				expect(lift).toBeGreaterThan(0);
				expect(lift).toBeLessThan(surface.ry);

				// Поднятая столешница не должна уезжать выше круга рассадки: дальние
				// игроки стоят ЗА столом, и он подрезает их, а не они его.
				expect(lift + surface.ry).toBeLessThan(ry);

				// Стол вместе с поднятой крышкой и кружками влезает в свободное поле.
				const center = tableCenterY();
				expect(center - lift - surface.ry).toBeGreaterThanOrEqual(tableField().top);
				expect(center - ry - badgeHeight / 2).toBeGreaterThanOrEqual(tableField().top);

				// Карты лежат на крышке — вместе с ней поднятые над полом и внутри её
				// краёв, а не свисая с дальнего.
				const cards = tableCardPoint(count);
				expect(cards.y).toBeLessThan(-lift);
				expect(Math.abs(cards.y + lift)).toBeLessThan(surface.ry);
			});
		}
	}

	test('бейджи растут вместе с экраном', () => {
		resize(390, 844);
		const phone = playerRoomDiag(5);
		resize(1492, 1046);
		const desktop = playerRoomDiag(5);
		expect(phone).toBeGreaterThan(75);
		expect(desktop).toBeGreaterThan(phone);
	});

	test('чем больше игроков, тем мельче бейдж', () => {
		resize(1492, 1046);
		expect(playerRoomDiag(12)).toBeLessThan(playerRoomDiag(5));
	});
});

describe('рассадка', () => {
	const table = ['a', 'b', 'c', 'd', 'e'];

	test('обычный стол одинаков у всех, кто на него смотрит', () => {
		for (const viewer of table) {
			expect(roomPlayerOrder(table, viewer, false)).toEqual(table);
		}
	});

	test('стол от первого лица сажает смотрящего первым, порядок по кругу тот же', () => {
		expect(roomPlayerOrder(table, 'c', true)).toEqual(['c', 'd', 'e', 'a', 'b']);
		expect(roomPlayerOrder(table, 'a', true)).toEqual(table);
	});

	test('того, кого за столом уже нет, разворачивать не по чему', () => {
		expect(roomPlayerOrder(table, 'покойник', true)).toEqual(table);
	});

	test('первый в рассадке сидит внизу, ближе всех к смотрящему', () => {
		resize(1492, 1046);
		const {ry} = roomRadii(table.length);
		const first = roomPlayerPoint('a', table);
		expect(first.x).toBeCloseTo(0, 6);
		expect(first.y).toBeCloseTo(ry, 6);
		expect(isFarSeat(90)).toBe(false);
	});

	test('дальняя половина стола — верхняя: её и загораживает столешница', () => {
		resize(1492, 1046);
		for (const playerId of table) {
			const {y} = roomPlayerPoint(playerId, table);
			const deg = (360 / table.length) * table.indexOf(playerId) + 90;
			expect(isFarSeat(deg)).toBe(y < 0);
		}
	});

	test('места на самих боках стола — дальние: у кромки лучше уйти за стол', () => {
		expect(isFarSeat(0)).toBe(true);
		expect(isFarSeat(180)).toBe(true);
		expect(isFarSeat(360)).toBe(true);
		// Зазор узкий: чуть отойдя от бока вниз, игрок снова стоит перед столом.
		expect(isFarSeat(20)).toBe(false);
		expect(isFarSeat(160)).toBe(false);
	});
});

describe('ближние места стянуты к нижнему', () => {
	const seats = (count: number) => map(range(count), String);
	// Угол места на экране: как его видит стол, уже со стяжкой.
	const angleOf = (index: number, count: number) => {
		resize(1492, 1046);
		const table = seats(count);
		const {x, y} = roomPlayerPoint(String(index), table);
		const {rx, ry} = roomRadii(count);
		return (Math.atan2(y / ry, x / rx) * 180) / Math.PI;
	};

	test('сосед нижнего сидит ближе к нему, чем требует ровный эллипс', () => {
		// Семеро: по эллипсу соседи нижнего сидели бы на 90 ± 51.4°.
		const neighbour = angleOf(1, 7);
		expect(neighbour).toBeLessThan(90 + 51.4);
		expect(neighbour).toBeGreaterThan(90);
	});

	test('нижнее место, бока и дальняя половина не двигаются', () => {
		expect(angleOf(0, 8)).toBeCloseTo(90, 6);
		// Вчетвером второе место приходится ровно на бок стола — он же граница
		// половин, дальше которой стяжка не идёт.
		expect(angleOf(1, 4)).toBeCloseTo(180, 6);
		// Дальняя половина: 90 + 3·45 = 225°, стяжка её не касается.
		expect(angleOf(3, 8)).toBeCloseTo(-135, 6);
	});

	test('стяжка отдаёт бокам стола то, что забрала снизу', () => {
		resize(1492, 1046);
		const count = 7;
		const table = seats(count);
		const {rx, ry} = roomRadii(count);
		// Та же рассадка, но ровно по эллипсу — с ней и сравниваем.
		const plain = (index: number) => {
			const rad = (((360 / count) * index + 90) * Math.PI) / 180;
			return {x: rx * Math.cos(rad), y: ry * Math.sin(rad)};
		};
		const gap = (place: (index: number) => {x: number, y: number}, from: number, to: number) => {
			const a = place(from);
			const b = place(to);
			return Math.hypot(a.x - b.x, a.y - b.y);
		};
		const pulled = (index: number) => roomPlayerPoint(String(index), table);

		// Внизу стола просторно — оттуда и берём: соседи нижнего съезжаются.
		expect(gap(pulled, 0, 1)).toBeLessThan(gap(plain, 0, 1));
		// А на боку, где стол рисует стрелки со значками, становится просторнее.
		expect(gap(pulled, 1, 2)).toBeGreaterThan(gap(plain, 1, 2));
	});
});

describe('пересадка', () => {
	test('игрок доезжает до нового места кратчайшей дугой, а не через весь стол', () => {
		// С 350° на 10° — это шаг вперёд на 20°, а не разворот назад через стол.
		expect(unwrapAngle(10, 350)).toBe(370);
		expect(unwrapAngle(350, 10)).toBe(-10);
		// Соседнее место — просто соседнее место.
		expect(unwrapAngle(162, 90)).toBe(162);
		// Первому углу разматываться не от чего.
		expect(unwrapAngle(90, undefined)).toBe(90);
	});

	test('размотанный угол — тот же угол: место от этого не едет', () => {
		resize(1492, 1046);
		const order = ['a', 'b', 'c', 'd', 'e'];
		const straight = roomPlayerPoint('c', order);
		// Место 'c' — это 234°, но пришли мы к нему после двух оборотов по столу.
		const rad = (unwrapAngle(234, 720 + 90) * Math.PI) / 180;
		const {rx, ry} = roomRadii(order.length);
		expect(rx * Math.cos(rad)).toBeCloseTo(straight.x, 6);
		expect(ry * Math.sin(rad)).toBeCloseTo(straight.y, 6);
	});
});
