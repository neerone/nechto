import React from 'react';
import * as PIXI from 'pixi.js';
import {clamp} from 'lodash';
import {observer} from 'mobx-react-lite';
import {CustomPIXIComponent, withApp} from 'react-pixi-fiber';
import {config, useSpring} from 'react-spring/universal';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import {turnTimerColor} from 'client/helpers/turnColor';
import type {GraphicsBehaviorThis} from 'client/components/pixiPrimitives/behaviorTypes';
import GameController from 'client/controllers/gameController';

/**
 * Прицел на том, чей сейчас ход. Раньше ходящего отмечала зелёная точка на
 * макушке кружка — её на столе было не найти, а на полном столе она к тому же
 * горела сразу у двоих: в обмене не в idle оба его участника. Прицел один, и он
 * наводится ровно на того, чей ход (turnPlayerId).
 *
 * Он же часы: по контуру прицела бежит светящаяся стрелка. Полоски таймера
 * сверху экрана больше нет — время идёт здесь, на том, кого ждут.
 *
 * Часы эти показывают не остаток, а ход времени. Остаток тут не работает:
 * отпущенные секунды выходят, а сервер всё равно ждёт (см. server/models/Player),
 * и заполненная до края шкала перестала бы что-либо значить. Стрелка вместо
 * этого идёт по кругу вечно, а сколько времени прошло, говорит цвет — он
 * достаётся каждому кусочку контура в тот миг, когда стрелка по нему прошла, и
 * там остаётся до следующего её круга (см. turnTimerColor).
 *
 * Идёт она по самим уголкам и только по ним: просветы между уголками — не часть
 * пути, и время в них не тратится. Дойдя до конца уголка, стрелка тут же
 * оказывается в начале следующего. Иначе на пустом месте она пропадала бы почти
 * на треть круга, и часы больше молчали бы, чем шли.
 */

// Раствор прицела в долях радиуса бейджа: наведённый и в момент наводки.
const reticleAimedShare = 1.3;
const reticleWideShare = 2.6;
// Плечо уголка — в долях самого раствора, чтобы уголки не смыкались в рамку.
const reticleArmShare = 0.4;
// Скругление угла — в долях плеча. Скругление рисуем геометрией: скруглять стык
// линий умеет lineStyle({join}), но в этой версии pixi его ещё нет.
const reticleCornerShare = 0.5;
// Толщина уголков — в долях радиуса бейджа: на большом экране кружки крупные,
// и линия в пару пикселей на них теряется. Но прицел — рамка, а не обводка:
// толстая линия спорит с самим кружком.
const reticleThicknessShare = 0.03;
const reticleMinThickness = 1;
const reticleMaxThickness = 2.5;

// Сам прицел — тем же зелёным, каким на столе отмечено всё «сейчас». Он заметно
// тусклее стрелки: та идёт поверх, и спорить с ней прицелу незачем.
const reticleColor = 0x00ff00;
const reticleAlpha = 0.55;

// Круг стрелки — за столько секунд. Число ни к чему не привязано: отпущенные на
// ход секунды считает сервер, а часам важно другое — чтобы движение читалось, но
// не мельтешило на краю глаза.
const lapSeconds = 10;
// Шлейф ровно в круг: пройденное не гаснет, а так и остаётся гореть до тех пор,
// пока стрелка не пойдёт по нему снова и не перепишет его новым цветом. Круги
// разного цвета (см. turnTimerColor), поэтому граница между старым и новым — это
// и есть стрелка, и никакой другой отметки ей не нужно.
const trailLapSpan = 1;
const trailAlphaHead = 1;
// Голова чуть толще хвоста — по этому утолщению её видно и там, где соседние
// круги близки по цвету.
const trailWidthHead = 1.6;
const trailWidthFalloff = 0.8;
// Свечение: под самой линией идёт вторая, втрое толще и почти прозрачная. Ярче
// от простого поднятия яркости линия не станет — цвет у неё и так чистый, а
// толще её делать нельзя, прицел превратится в обод. Ореол же на тёмном столе
// читается именно как свет, и заодно смягчает край тонкой линии.
const glowWidthShare = 3;
const glowAlphaShare = 0.38;
// Дойдя до красного, цвет останавливается (см. turnTimerColor), и дальше тревогу
// набирает свет: следующий круг раздаёт ореолу лишнюю толщину — постепенно, той
// же стрелкой, кусочек за кусочком, — и на этом рост кончается. Круг, с которого
// он идёт, — сразу за последним цветным.
const glowGrowLap = 4;
const glowWidthMax = 4;

// Шаг разбиения контура: столько точек приходится на плечо уголка и столько же
// на само скругление. Кусочки выходят примерно по пикселю — крупнее нельзя: по
// ним разгорается голова стрелки, и ступени стали бы видны.
const armSamples = 16;
const cornerSamples = 16;
// Вырожденный отрезок пикси не переварит — нормаль в нём считать не из чего.
const minStrokeLength = 0.05;

/**
 * На сколько пути голова стрелки перетекает из цвета прошлого круга в свой.
 *
 * Без растяжки у головы жёсткий край, и вот что из этого выходит: весь контур
 * прицела — от силы четверть тысячи точек, и даже на быстром круге стрелка идёт
 * пару десятков точек в секунду, то есть меньше половины пикселя за кадр.
 * Сдвинуться плавно жёсткий край при такой скорости физически не может — он
 * через кадр-другой перекрашивает очередную точку из тусклой в яркую. На глаз
 * это ровно тем и выглядит: мерцающая точка, ползущая рывками.
 *
 * С растяжкой края нет вовсе: за кадр чуть меняется цвет сразу десятка точек, и
 * глаз читает это как непрерывное движение.
 */
const headFadeLength = 8;

// Сколько прицел сжимается на новой цели. Едет он к ней своей пружиной: как
// быстро — дело расстояния, а сжимается всегда одинаково.
const reticleAimMs = 380;
// Наведённый прицел дышит: чуть разжимается и сжимается обратно. Стоящая на
// столе рамка выглядит забытой, а дыхание показывает, что ход всё ещё тут.
const reticleBreathScale = 1.07;
const reticleBreathMs = 1300;

// Смешение двух цветов по каналам. Нужно ровно на голове стрелки: там свежий
// цвет перетекает в тот, что лежал на этом месте круг назад.
const mixColor = (from: number, to: number, share: number): number => {
	let mixed = 0;
	for (let shift = 16; shift >= 0; shift -= 8) {
		const channel = ((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * share;
		mixed |= Math.round(channel) << shift;
	}
	return mixed;
};

const corners = [
	// По часовой от макушки: правый верхний, правый нижний, левый нижний, левый
	// верхний. Уголок рисуется от плеча к углу и дальше вбок, и у двух из
	// четырёх этот собственный порядок идёт против часовой — их разворачиваем,
	// чтобы весь контур читался одним ходом стрелки.
	{sx: 1, sy: -1, isReversed: true},
	{sx: 1, sy: 1, isReversed: false},
	{sx: -1, sy: 1, isReversed: true},
	{sx: -1, sy: -1, isReversed: false},
];

interface IContourPoint {
	x: number;
	y: number;
	// Сколько контура пройдено до этой точки. Просветы между уголками в счёт не
	// идут вовсе: стрелка ходит по нарисованному, а не по воображаемому кругу, и
	// в пустоте ей делать нечего. Из-за этого же она идёт ровно — по углу от
	// середины прицела её скорость гуляла бы, у углов вдвое быстрее, чем на
	// середине плеча.
	at: number;
}

interface IContour {
	// Уголки по отдельности: одной ломаной их рисовать нельзя, иначе просветы
	// затянет линией.
	brackets: IContourPoint[][];
	length: number;
}

/**
 * Уголки прицела ломаными. Каждый — плечо к углу, дуга вокруг самого угла (он
 * же опорная точка кривой) и плечо от угла вбок.
 */
const reticleContour = (spread: number, arm: number, round: number): IContour => {
	const brackets: IContourPoint[][] = [];
	let passed = 0;
	for (const {sx, sy, isReversed} of corners) {
		const x = sx * spread;
		const y = sy * spread;
		const shape: {x: number, y: number}[] = [];
		for (let i = 0; i <= armSamples; i++) {
			const from = arm - (arm - round) * (i / armSamples);
			shape.push({x, y: y - sy * from});
		}
		// Квадратичная кривая: концы плеч, вершина угла — опорная точка.
		for (let i = 1; i <= cornerSamples; i++) {
			const t = i / cornerSamples;
			const back = 1 - t;
			shape.push({
				x: back * back * x + 2 * back * t * x + t * t * (x - sx * round),
				y: back * back * (y - sy * round) + 2 * back * t * y + t * t * y,
			});
		}
		for (let i = 1; i <= armSamples; i++) {
			const to = round + (arm - round) * (i / armSamples);
			shape.push({x: x - sx * to, y});
		}
		if (isReversed) shape.reverse();
		const points: IContourPoint[] = [];
		shape.forEach((point, index) => {
			const previous = index ? shape[index - 1] : undefined;
			if (previous) passed += Math.hypot(point.x - previous.x, point.y - previous.y);
			points.push({x: point.x, y: point.y, at: passed});
		});
		brackets.push(points);
	}
	return {brackets, length: passed};
};

interface ITurnReticleArcProps {
	app: PIXI.Application;
	spread: number;
	arm: number;
	round: number;
	thickness: number;
	// Момент старта отсчёта по часам (см. TimerController); 0 — отсчёта нет, и
	// прицел остаётся просто прицелом. Стрелку ведём от этой отметки, а не от
	// тикающих раз в секунду секунд: секунда — это шестьдесят кадров, и по ним
	// стрелка не шла бы, а прыгала.
	startedAt: number;
}

type ReticleGraphics = PIXI.Graphics & {
	reticleProps?: ITurnReticleArcProps;
	reticleContour?: IContour;
	reticleTick?: () => void;
};

const drawTurnReticle = (graphics: ReticleGraphics) => {
	const props = graphics.reticleProps;
	if (!props) return;
	const {spread, thickness, startedAt} = props;
	graphics.clear();
	if (spread <= 0 || thickness <= 0) return;
	// Ломаные пересчитываем только вместе с размером прицела: он меняется на
	// ресайзе окна, а кадров между этим — тысячи.
	const contour = graphics.reticleContour;
	if (!contour || contour.length <= 0) return;

	// Сам прицел — всегда и целиком: ходящего видно и в те мгновения, когда
	// никакого отсчёта нет (между этапами хода, до первого уведомления).
	for (const points of contour.brackets) {
		graphics.lineStyle(thickness, reticleColor, reticleAlpha);
		points.forEach(({x, y}, index) => index ? graphics.lineTo(x, y) : graphics.moveTo(x, y));
	}
	if (!startedAt) return;

	// Отсчёт всегда с нуля: свой startedAt приходит на каждый ход и на каждую
	// смену того, кого ждут (см. TimerController).
	const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
	const laps = elapsed / lapSeconds;
	// Где стрелка сейчас — в пройденной длине контура.
	const head = (laps - Math.floor(laps)) * contour.length;
	const trailLength = trailLapSpan * contour.length;
	// Сколько секунд назад стрелка была вот на столько позади себя.
	const secondsBehind = (behind: number) => (behind / contour.length) * lapSeconds;

	// behind — насколько середина кусочка отстала от головы, в длине контура.
	const stroke = (from: {x: number, y: number}, to: {x: number, y: number}, behind: number) => {
		const age = behind / trailLength;
		// Хвост длиннее того, что стрелка успела пройти, не бывает: в начале
		// отсчёта горит ровно столько, сколько по контуру уже прошли.
		if (age >= 1 || secondsBehind(behind) > elapsed) return;
		if (Math.hypot(to.x - from.x, to.y - from.y) < minStrokeLength) return;
		// Цвет — по кругам, а не по секундам: каждый новый круг стрелки должен
		// отличаться от предыдущего (см. turnTimerColor).
		const laps = (elapsed - secondsBehind(behind)) / lapSeconds;
		const blend = Math.min(1, behind / headFadeLength);
		const fresh = turnTimerColor(laps);
		// Голова не обрывается краем, а перетекает: на первых точках за ней цвет
		// смешан с тем, что лежал здесь круг назад. На первом круге мешать не с
		// чем — там она проступает из самого прицела.
		const isOverwriting = laps >= 1;
		const alpha = trailAlphaHead * (isOverwriting ? 1 : blend);
		if (alpha <= 0.004) return;
		const color = isOverwriting && blend < 1
			? mixColor(turnTimerColor(laps - 1), fresh, blend)
			: fresh;
		const width = thickness * (1 + (trailWidthHead - 1) * blend * Math.pow(1 - age, trailWidthFalloff));
		// Сначала ореол, потом сама линия: она должна лечь поверх своего света.
		const glow = glowWidthShare
			+ (glowWidthMax - glowWidthShare) * clamp(laps - glowGrowLap, 0, 1);
		graphics.lineStyle(width * glow, color, alpha * glowAlphaShare);
		graphics.moveTo(from.x, from.y);
		graphics.lineTo(to.x, to.y);
		graphics.lineStyle(width, color, alpha);
		graphics.moveTo(from.x, from.y);
		graphics.lineTo(to.x, to.y);
	};

	for (const points of contour.brackets) {
		for (let i = 1; i < points.length; i++) {
			const from = points[i - 1];
			const to = points[i];
			if (!from || !to || to.at <= from.at) continue;
			// Кусочек, на котором стрелка стоит прямо сейчас, дорисовываем ровно
			// до неё — иначе она перескакивала бы с точки на точку.
			if (head > from.at && head <= to.at) {
				const share = (head - from.at) / (to.at - from.at);
				stroke(from, {
					x: from.x + (to.x - from.x) * share,
					y: from.y + (to.y - from.y) * share,
				}, (head - from.at) / 2);
				continue;
			}
			// Насколько давно стрелка прошла этот кусочек — в длине контура,
			// считая назад от его середины и по кругу.
			const middle = (from.at + to.at) / 2;
			stroke(from, to, ((head - middle) % contour.length + contour.length) % contour.length);
		}
	}
};

const detachTurnReticle = (graphics: ReticleGraphics) => {
	if (!graphics.reticleTick) return;
	graphics.reticleProps?.app.ticker.remove(graphics.reticleTick);
	graphics.reticleTick = undefined;
};

const TYPE = 'TurnReticleArc';
const behavior = {
	customDisplayObject: (_props: ITurnReticleArcProps) => new PIXI.Graphics() as ReticleGraphics,
	customApplyProps: function(
		this: GraphicsBehaviorThis<ITurnReticleArcProps>,
		instance: ReticleGraphics,
		oldProps: ITurnReticleArcProps | undefined,
		newProps: ITurnReticleArcProps,
	) {
		const isSameShape = oldProps
			&& oldProps.spread === newProps.spread
			&& oldProps.arm === newProps.arm
			&& oldProps.round === newProps.round;
		instance.reticleProps = newProps;
		if (!isSameShape) instance.reticleContour = reticleContour(newProps.spread, newProps.arm, newProps.round);
		// Первый кадр рисуем сразу: до ближайшего тика прицел иначе моргнёт пустотой.
		drawTurnReticle(instance);
		this.applyDisplayObjectProps(oldProps, newProps);
	},
	// Стрелка идёт сама по себе, кадрами пикси, а не перерисовкой React: React
	// прицелу нужен, только когда сменился ходящий или начался новый отсчёт, — а
	// гонять реконсиляцию по шестьдесят раз в секунду ради одной фигуры незачем.
	customDidAttach: (instance: ReticleGraphics) => {
		const props = instance.reticleProps;
		if (!props || instance.reticleTick) return;
		instance.reticleTick = () => {
			// Стол мог уехать целиком — конец партии, реконнект, уход в лобби.
			// react-pixi-fiber зовёт customWillDetach только у той фигуры, которую
			// снимает сам, а всё вложенное просто уничтожает вместе с родителем
			// (см. removeChild) — и наш кадр стучался бы в уничтоженную графику.
			// Оставшись без родителя, снимаемся с тикера сами.
			if (!instance.parent) return detachTurnReticle(instance);
			drawTurnReticle(instance);
		};
		props.app.ticker.add(instance.reticleTick);
	},
	customWillDetach: (instance: ReticleGraphics) => detachTurnReticle(instance),
};

const TurnReticleArc = withApp(CustomPIXIComponent(behavior, TYPE));

interface ITurnReticleProps {
	controller: GameController;
	// Место цели: пока прицел до неё едет, она может и уехать сама.
	x: number;
	y: number;
	badgeRadius: number;
	// Цель. Меняется — прицел наводится заново.
	playerId: string;
}

const TurnReticle = observer(({controller, x, y, badgeRadius, playerId}: ITurnReticleProps) => {
	const {isActive} = controller.root.timerController;
	// Часы одни на весь ход. Сервер заводит таймер на каждый его этап — взять
	// карту, сыграть её, обменяться (см. Player.changeTurnState), — и по его
	// уведомлениям стрелка сбрасывалась бы трижды за ход, всякий раз начиная с
	// зелёного. Поэтому отмеряем от того мгновения, когда ход перешёл к этому
	// игроку, и до тех пор, пока он не уйдёт к следующему.
	const turnOwner = React.useRef('');
	const turnStartedAt = React.useRef(0);
	if (turnOwner.current !== playerId) {
		turnOwner.current = playerId;
		turnStartedAt.current = Date.now();
	}
	// Переезд к новой цели: своей пружиной, поэтому прицел догоняет и того, кто
	// сам переехал (смена мест), а не только смену хода. Поля названы не x/y:
	// react-spring считает такие пружины svg-атрибутами и типизирует их не
	// числами, а долями оборота.
	const move = useSpring<{aimX: number, aimY: number}>({aimX: x, aimY: y, config: config.stiff});
	// Наводка: прицел приходит широко раскрытым и сжимается на цели. Сжимается он
	// масштабом контейнера, а не собственным раствором: пересобирать на каждом
	// кадре наводки ещё и ломаные контура незачем.
	//
	// Сама наводка — императивной пружиной: перезапускать её надо на смене цели,
	// а не на каждом рендере стола.
	const [aim, setAim] = useSpring<{aimScale: number}>(() => ({aimScale: 1, config: {duration: reticleAimMs}}));
	React.useEffect(() => {
		setAim({aimScale: 1, from: {aimScale: reticleWideShare / reticleAimedShare}, reset: true});
	}, [playerId]);
	// Дыхание — своей пружиной и своим контейнером, поверх наводки: они живут
	// независимо, и качание не сбивается всякий раз, как ход уходит дальше.
	// Качает его таймер: зациклить саму пружину в этой версии react-spring
	// нечем — onRest, переданный в set(), не доходит, а бесконечная цепочка
	// через async to есть только в рантайме, в типах её нет.
	const [breath, setBreath] = useSpring<{breathScale: number}>(() => ({breathScale: 1, config: {duration: reticleBreathMs}}));
	React.useEffect(() => {
		let isOut = false;
		const timer = setInterval(() => {
			isOut = !isOut;
			setBreath({breathScale: isOut ? reticleBreathScale : 1});
		}, reticleBreathMs);
		return () => clearInterval(timer);
	}, []);

	const spread = badgeRadius * reticleAimedShare;
	const arm = spread * reticleArmShare;
	return (
		<AnimatedPixi.Container x={move.aimX} y={move.aimY}>
			<AnimatedPixi.Container scale={aim.aimScale}>
				<AnimatedPixi.Container scale={breath.breathScale}>
					<TurnReticleArc
						spread={spread}
						arm={arm}
						round={arm * reticleCornerShare}
						thickness={clamp(badgeRadius * reticleThicknessShare, reticleMinThickness, reticleMaxThickness)}
						startedAt={isActive ? turnStartedAt.current : 0}
					/>
				</AnimatedPixi.Container>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
});

export default TurnReticle;
