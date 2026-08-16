import React from 'react';
import * as PIXI from 'pixi.js';
import {clamp} from 'lodash';
import {observer} from 'mobx-react-lite';
import {CustomPIXIComponent, withApp} from 'react-pixi-fiber';
import type {GraphicsBehaviorThis} from 'client/components/pixiPrimitives/behaviorTypes';
import GameController from 'client/controllers/gameController';

/**
 * Круговая шкала хода: по краю столешницы бесконечно идёт тонкая светящаяся
 * линия.
 *
 * Это часы, а не полоска остатка. Время хода не «кончается»: отпущенные секунды
 * выходят, а сервер всё равно ждёт (см. server/models/Player), и полоска в этот
 * момент упиралась бы в край и переставала что-либо значить. Линия вместо этого
 * идёт дальше — по кругу, вечно.
 *
 * Сколько времени прошло, показывает цвет. Линия красится не «как сейчас», а тем
 * цветом, который был в момент, когда её рисовали: пройденное остаётся позади
 * нетронутым, а голова кладёт поверх него новое. Шлейф длиннее круга, поэтому
 * линия наезжает сама на себя, и на кольце одновременно видно несколько своих
 * же оборотов — свежий поверх выцветающих старых.
 *
 * Живёт на столешнице (рисуется после неё, но до колоды): шкала лежит на столе,
 * а не висит над ним, — сжата вместе с ним и поднята на его высоту.
 */

// Круг — за столько секунд. Число ни к чему не привязано: отпущенные на ход
// секунды показывает полоска сверху, а шкала на столе просто отмеряет время, и
// главное здесь — чтобы движение читалось, но не мельтешило на краю глаза.
const ringLapSeconds = 45;

// Длина шлейфа в кругах. Больше единицы нарочно: на этом и держится картинка —
// линия догоняет собственный след и идёт поверх него.
const trailLapSpan = 2.5;
// Сколько отрезков в одном круге: по ним ломается эллипс, и на глаз он должен
// остаться гладким.
const trailSegmentsPerLap = 72;

// Внешний край шкалы — в долях полуоси столешницы. Не по самому её краю: между
// шкалой и кантом остаётся полоска стола, иначе кольцо читается вторым кантом
// (см. TableSurface).
const ringOuterShare = 0.95;

// Толщина линии — в тех же долях, но с упором в обе стороны: на маленьком столе
// она не должна пропасть вовсе, на большом — расползтись в обод.
const trailWidthShare = 0.012;
const trailWidthMin = 1.5;
const trailWidthMax = 5;

// Хвост тусклее и чуть тоньше головы — иначе не понять, куда линия едет. Но
// именно чуть: это линия, а не комета, и на своих старых витках она должна
// оставаться линией.
const trailAlphaHead = 0.95;
const trailAlphaFalloff = 1.8;
const trailWidthTail = 0.55;
const trailWidthFalloff = 0.8;

const twoPi = Math.PI * 2;

/**
 * Цвет линии по тому, на какой секунде хода её нарисовали.
 *
 * Тон идёт по кругу и проходит его целиком за colorCycleSeconds: зелёный,
 * жёлтый, красный, малиновый, фиолетовый, синий — и обратно к зелёному. Круг, а
 * не «дошли до малинового и встали»: ход бывает и в три минуты длиной, и всё это
 * время шкала должна показывать, что время идёт, а не замереть одним цветом.
 *
 * Оборот цвета заметно длиннее оборота самой линии — поэтому её витки, лежащие
 * друг на друге, всегда разного цвета, и видно, какой из них свежий.
 */
const colorCycleSeconds = 200;
const colorStartHue = 110;
const trailHue = (seconds: number): number => colorStartHue - 360 * (seconds / colorCycleSeconds);

/**
 * HSL → 0xRRGGBB. Шкала ведёт цвет тоном, а не тремя каналами: тон здесь —
 * величина со смыслом (сколько времени прошло), и считать его удобно одним
 * числом.
 */
const hslColor = (hue: number, saturation: number, lightness: number): number => {
	const sector = ((((hue % 360) + 360) % 360) / 60);
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const second = chroma * (1 - Math.abs((sector % 2) - 1));
	const rgb: [number, number, number] = sector < 1 ? [chroma, second, 0]
		: sector < 2 ? [second, chroma, 0]
		: sector < 3 ? [0, chroma, second]
		: sector < 4 ? [0, second, chroma]
		: sector < 5 ? [second, 0, chroma]
		: [chroma, 0, second];
	const [red, green, blue] = rgb;
	const base = lightness - chroma / 2;
	const byte = (value: number) => clamp(Math.round((value + base) * 255), 0, 255);
	return (byte(red) << 16) | (byte(green) << 8) | byte(blue);
};

interface ITimerArcProps {
	app: PIXI.Application;
	rx: number;
	ry: number;
	trailWidth: number;
	// Момент старта отсчёта по часам (см. TimerController). Линию ведём от него,
	// а не от тикающих раз в секунду currentSeconds: секунда — это шестьдесят
	// кадров, и по ним она не шла бы, а прыгала.
	startedAt: number;
	// Куда идёт очередь хода: +1 по часовой, −1 против. Шкала идёт туда же, куда
	// смотрят стрелки на столешнице, — вместе они читаются одним движением.
	direction: number;
}

type TimerArcGraphics = PIXI.Graphics & {
	timerArc?: ITimerArcProps;
	timerTick?: () => void;
};

/**
 * Точка на шкале. Ноль — верх стола, дальше по ходу очереди: шкала — циферблат,
 * и её ноль должен стоять там же, где у часов.
 */
const ringPoint = (angle: number, rx: number, squash: number, direction: number) => {
	const turned = angle * direction;
	return {x: rx * Math.sin(turned), y: -rx * squash * Math.cos(turned)};
};

/**
 * Кусок шкалы между двумя углами — четырёхугольник между внешним и внутренним
 * эллипсами.
 *
 * Именно заливка, а не линия: скруглять концы и стыки линий эта версия pixi ещё
 * не умеет (см. Reticle), и ломаная из отрезков рвалась бы на каждом стыке — а
 * их здесь под сотню. У соседних четырёхугольников общая грань, и шва между
 * ними нет по построению.
 *
 * Внутрь шкала растёт скруглением полуосей, а не сдвигом по нормали: кольцо
 * нарисовано на столешнице, и в проекции его ширина сжимается вместе с ней —
 * у дальнего и ближнего краёв стола полоска уже, чем на боках.
 */
const bandQuad = (
	graphics: PIXI.Graphics,
	from: number,
	to: number,
	rx: number,
	width: number,
	squash: number,
	direction: number,
	color: number,
	alpha: number,
) => {
	if (alpha <= 0.004 || width <= 0) return;
	const innerRx = Math.max(0, rx - width);
	const outerFrom = ringPoint(from, rx, squash, direction);
	const outerTo = ringPoint(to, rx, squash, direction);
	const innerTo = ringPoint(to, innerRx, squash, direction);
	const innerFrom = ringPoint(from, innerRx, squash, direction);
	graphics.beginFill(color, alpha);
	graphics.drawPolygon([
		outerFrom.x, outerFrom.y,
		outerTo.x, outerTo.y,
		innerTo.x, innerTo.y,
		innerFrom.x, innerFrom.y,
	]);
	graphics.endFill();
};

const drawTimerArc = (graphics: TimerArcGraphics) => {
	const props = graphics.timerArc;
	if (!props) return;
	const {rx, ry, trailWidth, startedAt, direction} = props;
	graphics.clear();
	if (rx <= 0 || ry <= 0 || !startedAt) return;

	const squash = ry / rx;
	// Отсчёт всегда с нуля: свой startedAt приходит на каждый ход и на каждую смену
	// того, кого ждут (см. TimerController), — новая очередь начинает шкалу заново,
	// с пустого кольца и с зелёного цвета.
	const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
	// Шлейф не тянется в то время, которого ещё не было: в начале хода он ровно
	// такой длины, сколько его успели нарисовать.
	const spanSeconds = Math.min(trailLapSpan * ringLapSeconds, elapsed);
	const segments = Math.max(1, Math.ceil(trailSegmentsPerLap * (spanSeconds / ringLapSeconds)));

	// Идём от головы назад: она обязана стоять ровно на своём месте, а набегающая
	// по кусочкам ошибка пусть достаётся хвосту, где её не видно. Именно назад, а
	// не вперёд: витки ложатся друг на друга, и сверху должен оказаться свежий.
	for (let i = segments - 1; i >= 0; i--) {
		const backFrom = (i / segments) * spanSeconds;
		const backTo = ((i + 1) / segments) * spanSeconds;
		const back = (backFrom + backTo) / 2;
		// Доля всего шлейфа позади головы — по ней линия и гаснет.
		const fade = back / (trailLapSpan * ringLapSeconds);
		bandQuad(
			graphics,
			((elapsed - backFrom) / ringLapSeconds) * twoPi,
			((elapsed - backTo) / ringLapSeconds) * twoPi,
			rx,
			trailWidth * (trailWidthTail + (1 - trailWidthTail) * Math.pow(1 - fade, trailWidthFalloff)),
			squash,
			direction,
			hslColor(trailHue(elapsed - back), 1, 0.55),
			trailAlphaHead * Math.pow(1 - fade, trailAlphaFalloff),
		);
	}
};

const detachTimerArc = (graphics: TimerArcGraphics) => {
	if (!graphics.timerTick) return;
	graphics.timerArc?.app.ticker.remove(graphics.timerTick);
	graphics.timerTick = undefined;
};

const TYPE = 'TimerArc';
const behavior = {
	// Рисуем обычным смешиванием, а не сложением. Сложение на тёмном столе даёт
	// красивое свечение, но линия ходит по собственному следу: на каждом
	// пересечении цвета складывались бы в белое, и кольцо выгорало бы тем
	// сильнее, чем дольше идёт ход. Здесь свежий виток просто ложится поверх
	// старого — ровно то, что и должно быть видно.
	customDisplayObject: (_props: ITimerArcProps) => new PIXI.Graphics() as TimerArcGraphics,
	customApplyProps: function(
		this: GraphicsBehaviorThis<ITimerArcProps>,
		instance: TimerArcGraphics,
		oldProps: ITimerArcProps | undefined,
		newProps: ITimerArcProps,
	) {
		instance.timerArc = newProps;
		// Первый кадр рисуем сразу: до ближайшего тика шкала иначе моргнёт пустотой.
		drawTimerArc(instance);
		this.applyDisplayObjectProps(oldProps, newProps);
	},
	// Линия идёт сама по себе, кадрами пикси, а не перерисовкой React: React ей
	// нужен ровно дважды за ход — когда отсчёт начался и когда кончился, — а
	// гонять реконсиляцию по шестьдесят раз в секунду ради одной фигуры незачем.
	customDidAttach: (instance: TimerArcGraphics) => {
		const props = instance.timerArc;
		if (!props || instance.timerTick) return;
		instance.timerTick = () => {
			// Стол мог уехать целиком — конец партии, реконнект, уход в лобби.
			// react-pixi-fiber зовёт customWillDetach только у той фигуры, которую
			// снимает сам, а всё вложенное просто уничтожает вместе с родителем
			// (см. removeChild) — и наш кадр стучался бы в уничтоженную графику.
			// Оставшись без родителя, снимаемся с тикера сами.
			if (!instance.parent) return detachTimerArc(instance);
			drawTimerArc(instance);
		};
		props.app.ticker.add(instance.timerTick);
	},
	customWillDetach: (instance: TimerArcGraphics) => detachTimerArc(instance),
};

const TimerArc = withApp(CustomPIXIComponent(behavior, TYPE));

interface ITurnTimerRingProps {
	controller: GameController;
	// Полуоси столешницы и её высота над полом: шкала лежит на ней, а не на полу
	// (см. TableSurface).
	rx: number;
	ry: number;
	lift: number;
}

const TurnTimerRing = observer(({controller, rx, ry, lift}: ITurnTimerRingProps) => {
	const {isActive, startedAt} = controller.root.timerController;
	if (!isActive || !startedAt || rx <= 0 || ry <= 0) return null;
	const ringRx = rx * ringOuterShare;
	// Без обёртки-контейнера, хотя подъём просится в неё: снимая контейнер, React
	// уничтожил бы фигуру внутри, не спросив её customWillDetach, — а ей надо
	// успеть снять свой кадр с тикера (см. detachTimerArc).
	return (
		<TimerArc
			y={-lift}
			rx={ringRx}
			ry={ringRx * (ry / rx)}
			trailWidth={clamp(rx * trailWidthShare, trailWidthMin, trailWidthMax)}
			startedAt={startedAt}
			direction={controller.isClockwise ? 1 : -1}
		/>
	);
});

export default TurnTimerRing;
