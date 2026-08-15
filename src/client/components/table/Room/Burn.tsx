import React from 'react';
import {filter, includes, map, reduce} from 'lodash';
import * as PIXI from 'pixi.js';
import {Text} from 'react-pixi-fiber';
import {useSpring} from 'react-spring/universal';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import {BadgeBody, BadgeShade, formatNickname, QuarantineSkin, StatusSkin} from 'client/components/table/PlayerBadge/PlayerBadge';
import {EEventID} from 'shared/enum/cards';
import {playFlamethrower} from 'client/helpers/sounds';
import GameController from 'client/controllers/gameController';
import {burnMs} from 'client/helpers/burnTiming';
import {badgeAspect} from 'client/helpers/roomHelpers';

// Сожжение огнемётом. Поджигатель поливает соседа струёй огня во всю ширину
// стола, кружок жертвы чернеет, обугливается и прогорает, а на его месте стоит
// столб пламени с искрами. Само пламя и прогорание считает видеокарта (см. Fire
// и Dissolve), здесь только их расписание.
//
// Пока костёр горит, стол стоит на месте: Room держит сгоревшего на его месте
// и никого не пересаживает (см. useBurns и burnedOut). Это заметное событие
// партии, и его дают разглядеть.

// Доли времени: когда кружок начинает чернеть, когда огонь начинает его
// выедать и когда от него ничего не остаётся. Чернеет он загодя и не спеша —
// большую часть костра обугленный кружок ещё виден.
const charFrom = 0.06;
const charTo = 0.42;
const burnFrom = 0.3;
const burnTo = 0.88;
// Размеры в долях радиуса бейджа: столб пламени и языки перед кружком. Главный
// столб идёт ЗА кружком, а перед ним — только языки поменьше: так видно, как
// сам кружок обугливается и прогорает, а не сплошную стену огня поверх него.
const fireWidthShare = 4.6;
const fireHeightShare = 9.0;
const frontWidthShare = 2.6;
const frontHeightShare = 4.4;
// Вспышка в момент поджога: её квад квадратный и заведомо больше кружка —
// ударной волне надо куда расходиться, иначе её обрежет краями.
const burstShare = 9.0;
// Дым над догорающим кружком: он шире и выше пламени и уходит уже под конец.
const smokeWidthShare = 6.0;
const smokeHeightShare = 11.0;
// Своё зерно у языков перед бейджем и у струи: с общим они повторяли бы столб
// за бейджем движение в движение.
const frontSeedShift = 0.37;
const jetSeedShift = 0.71;
const ashSeedShift = 0.53;
// Струя огнемёта: ширина в долях радиуса бейджа, во сколько раз она перекрывает
// расстояние до жертвы (её сдувает далеко за неё — это огнемёт, а не спичка) и
// доля времени костра, которую она хлещет.
const jetWidthShare = 10.0;
const jetOvershoot = 5.0;
const jetPart = 0.5;
// Насколько позже струи занимается сам игрок: пламени надо долететь.
const burnDelay = 0.08;
// Насколько глушится сцена вокруг пожара и как широко ложится отсвет на соседей
// (в долях радиуса бейджа). Затемнение неглубокое: стол должен читаться.
const dimStrength = 0.55;
// Насколько блик сдвинут от центра кружка к пожару — в долях габарита кружка
// (сам кружок в этих долях имеет радиус 0.5).
const glintPull = 0.3;
// Тень позади соседа: ширина и длина в радиусах бейджа.
const shadowWidthShare = 4.4;
const shadowLengthShare = 4.0;
// Доли времени, за которые затемнение наезжает и уходит.
const dimFadeIn = 0.22;
const dimFadeOut = 0.3;

// Сглаживание концов: тот же smoothstep, только над готовой долей 0..1.
const ease = (value: number): number => value * value * (3 - 2 * value);
// Куда упирается основание пламени: чуть ниже центра кружка, чтобы огонь шёл
// из-под бейджа, а не из его середины.
const fireBaseShare = 1.3;

interface IPoint {
	x: number;
	y: number;
}

export interface IBurn {
	seq: number;
	playerId: string;
	// Где горит — место сожжённого за столом.
	x: number;
	y: number;
	// Откуда бьёт струя — место того, кто поджёг.
	fromX: number;
	fromY: number;
	// Место сгоревшего в рассадке: пока он горит, стол держит его за столом.
	seat: number;
}

// Свой рисунок пламени у каждого костра. Берём из номера события, а не из
// случайного числа: один и тот же костёр не должен перерисовываться заново на
// каждом кадре пружины.
const seedOf = (seq: number): number => (seq * 0.6180339887) % 1;

// Прямоугольник во весь холст (в координатах стола) — им костёр приглушает
// сцену вокруг себя.
export interface IDimRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface IBurningPlayerProps {
	burn: IBurn;
	controller: GameController;
	badgeRadius: number;
	dim: IDimRect;
	// Места соседей по столу: на них ложатся блики от пожара.
	glints: IPoint[];
}

const BurningPlayer = ({burn: {seq, playerId, x, y, fromX, fromY}, controller, badgeRadius, dim, glints}: IBurningPlayerProps) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: burnMs},
	});
	const player = controller.players[playerId];
	// Роль сгоревшего мы могли и не знать — кружок рисуем ровно тот, что стоял на
	// столе, иначе на месте игрока вспыхнет чужой. Со статусом поверх (см.
	// StatusSkin) он и горит: сгорает то, на что все смотрели.

	const seed = seedOf(seq);
	const size = badgeRadius * 2;
	const fireBase = badgeRadius * fireBaseShare;

	// Струя огнемёта: пламя того же шейдера, только повёрнутое от поджигателя к
	// цели. Растёт оно вверх (в −y), поэтому доворачиваем на четверть оборота.
	// Бьёт она заведомо дальше жертвы: огнемёт сдувает всё, что за ней.
	const jetAngle = Math.atan2(y - fromY, x - fromX);
	const jetLength = Math.hypot(x - fromX, y - fromY) * jetOvershoot;

	// Секунды с начала горения: ими живёт турбулентность в шейдере.
	const time = t.interpolate(progress => progress * burnMs / 1000);
	// Пока струя летит, гореть жертве ещё нечем: её собственный огонь стартует с
	// небольшим опозданием, а струя, наоборот, живёт только в самом начале.
	const life = t.interpolate(progress => Math.max(0, (progress - burnDelay) / (1 - burnDelay)));
	const jetLife = t.interpolate(progress => Math.min(1, progress / jetPart));
	const burnProgress = t.interpolate(progress =>
		Math.min(1, Math.max(0, (progress - burnFrom) / (burnTo - burnFrom))));
	// Кружок обугливается раньше, чем прогорает: сначала чернеет весь, и только
	// потом огонь начинает его выедать.
	const charProgress = t.interpolate(progress =>
		Math.min(1, Math.max(0, (progress - charFrom) / (charTo - charFrom))));
	// Сцена вокруг пожара приглушается: на тёмном столе огонь читается ярче, и
	// сразу видно, что происходит именно здесь. Затемнение — первым ребёнком
	// костра, поэтому сам огонь, кружок и блики ложатся уже поверх него. Наезжает
	// и уходит оно медленно и со сглаживанием по краям: резкое затемнение читается
	// как мигание света, а не как отсвет пожара.
	const dimAlpha = t.interpolate(progress => {
		const rising = ease(Math.min(1, progress / dimFadeIn));
		const falling = ease(Math.min(1, Math.max(0, (1 - progress) / dimFadeOut)));
		return dimStrength * rising * falling;
	});
	// Куда смотрит сосед относительно пожара. Костёр стоит в начале координат
	// контейнера, поэтому направление «на огонь» — это просто путь к нулю.
	const towardsFire = (point: IPoint): IPoint => {
		const dx = -(point.x - x);
		const dy = -(point.y - y);
		const length = Math.hypot(dx, dy) || 1;
		return {x: dx / length, y: dy / length};
	};
	// Воздух дрожит, пока есть чему гореть, и успокаивается вместе с пламенем.
	const heat = t.interpolate(progress =>
		Math.min(1, progress / charFrom) * Math.min(1, Math.max(0, (1 - progress) / 0.3)));
	return (
		<AnimatedPixi.Container x={x} y={y} interactiveChildren={false}>
			{/* Приглушённая сцена. Спрайт белой точки, растянутый на весь холст и
			    залитый чёрным: отдельная картинка для этого не нужна. */}
			<AnimatedPixi.Sprite
				texture={PIXI.Texture.WHITE}
				tint={0x000000}
				alpha={dimAlpha}
				x={dim.x - x}
				y={dim.y - y}
				width={dim.width}
				height={dim.height}
			/>
			{/* Тени соседей: пожар светит сбоку, и позади каждого ложится тёмный
			    след. Рисуем до бликов, чтобы свет ложился поверх тени. */}
			{map(glints, (point, index) => {
				const toFire = towardsFire(point);
				// Тень тянется от игрока прочь от огня: квад растёт «вверх», значит
				// доворачиваем его на четверть оборота от направления на пожар.
				const away = Math.atan2(-toFire.y, -toFire.x);
				return (
					<AnimatedPixi.Fire
						key={index}
						x={point.x - x}
						y={point.y - y}
						rotation={away + Math.PI / 2}
						fireWidth={badgeRadius * shadowWidthShare}
						fireHeight={badgeRadius * shadowLengthShare}
						originUp={0}
						time={time}
						life={life}
						seed={seed + index * 0.31}
						mode={'shadow'}
					/>
				);
			})}
			{/* Отсветы пожара на соседях: они уже приглушены затемнением, и живой
			    дрожащий свет по ним читается сразу. */}
			{map(glints, (point, index) => {
				const toFire = towardsFire(point);
				return (
					<AnimatedPixi.Fire
						key={index}
						// Квад ровно по габариту кружка: по нему шейдер и обрезает свет.
						x={point.x - x}
						y={point.y - y + badgeRadius}
						fireWidth={badgeRadius * 2}
						fireHeight={badgeRadius * 2}
						// Ось y у квада смотрит вверх, у стола — вниз, отсюда минус.
						glintX={toFire.x * glintPull}
						glintY={-toFire.y * glintPull}
						originUp={0.5}
						time={time}
						life={life}
						seed={seed + index * 0.19}
						mode={'glint'}
					/>
				);
			})}
			{/* Главный столб — за кружком: сквозь него видно, как кружок обугливается. */}
			<AnimatedPixi.Fire
				y={fireBase}
				fireWidth={badgeRadius * fireWidthShare}
				fireHeight={badgeRadius * fireHeightShare}
				originUp={fireBaseShare / fireHeightShare}
				time={time}
				life={life}
				seed={seed}
			/>
			{/* Струя от поджигателя. Рисуем её в координатах костра: сам костёр стоит
			    на месте жертвы, поэтому поджигатель — это смещение до него. */}
			<AnimatedPixi.Fire
				x={fromX - x}
				y={fromY - y}
				rotation={jetAngle + Math.PI / 2}
				fireWidth={badgeRadius * jetWidthShare}
				fireHeight={jetLength}
				originUp={1 / jetOvershoot}
				time={time}
				life={jetLife}
				seed={seed + jetSeedShift}
				mode={'jet'}
			/>
			{player && (
				<AnimatedPixi.Dissolve burn={burnProgress} char={charProgress} heat={heat} seed={seed} time={time}>
					<BadgeBody
						isDoor={false}
						isConnected={player.isConnected}
						color={player.color}
						avatar={player.avatar}
						badgeWidth={size}
						badgeHeight={size * badgeAspect}
					/>
					<StatusSkin
						badgeWidth={size}
						badgeHeight={size * badgeAspect}
						isConnected={player.isConnected}
						isThing={player.isThing}
						isInfected={player.isInfected}
						avatar={player.avatar}
					/>
					<BadgeShade badgeWidth={size} badgeHeight={size * badgeAspect}/>
					<Text
						text={player.isYou ? 'ТЫ' : (formatNickname(player.nickname) ?? '')}
						anchor={0.5}
						style={{fontFamily: 'Arial', fontSize: 14, fill: 0xFFFFFF, align: 'center'}}
					/>
					{/* Цепи последними — тем же слоем, что и за столом (см. PlayerBadge):
					    горит тот же кружок, каким игрок сидел. */}
					<QuarantineSkin
						quarantine={player.quarantine}
						isConnected={player.isConnected}
						badgeWidth={size}
						badgeHeight={size * badgeAspect}
					/>
				</AnimatedPixi.Dissolve>
			)}
			{/* Языки перед кружком: без них он выглядел бы вырезанным из пожара. */}
			<AnimatedPixi.Fire
				y={fireBase}
				fireWidth={badgeRadius * frontWidthShare}
				fireHeight={badgeRadius * frontHeightShare}
				originUp={fireBaseShare / frontHeightShare}
				time={time}
				life={life}
				seed={seed + frontSeedShift}
			/>
			{/* Вспышка от поджога — на своём просторном кваде, по центру кружка. */}
			<AnimatedPixi.Fire
				y={badgeRadius * burstShare / 2}
				fireWidth={badgeRadius * burstShare}
				fireHeight={badgeRadius * burstShare}
				originUp={0.5}
				time={time}
				life={life}
				seed={seed}
				mode={'burst'}
			/>
			{/* Пепел: чёрные крупинки летят и от струи, и от самого горящего кружка.
			    Слой отдельный — он темнит, а огонь светится. */}
			<AnimatedPixi.Fire
				x={fromX - x}
				y={fromY - y}
				rotation={jetAngle + Math.PI / 2}
				fireWidth={badgeRadius * jetWidthShare}
				fireHeight={jetLength}
				originUp={1 / jetOvershoot}
				time={time}
				life={jetLife}
				seed={seed + jetSeedShift}
				mode={'ash'}
			/>
			<AnimatedPixi.Fire
				y={fireBase}
				fireWidth={badgeRadius * fireWidthShare}
				fireHeight={badgeRadius * fireHeightShare}
				originUp={fireBaseShare / fireHeightShare}
				time={time}
				life={life}
				seed={seed + ashSeedShift}
				mode={'ash'}
			/>
			{/* Дым поверх всего: он уходит, когда огонь уже опал. */}
			<AnimatedPixi.Fire
				y={fireBase}
				fireWidth={badgeRadius * smokeWidthShare}
				fireHeight={badgeRadius * smokeHeightShare}
				originUp={fireBaseShare / smokeHeightShare}
				time={time}
				life={life}
				seed={seed}
				mode={'smoke'}
			/>
		</AnimatedPixi.Container>
	);
};

/**
 * Костры, которые сейчас горят на столе. Событие сожжения приходит тем же
 * потоком применённых карт, что и всё остальное (cardEffects), — от него берём
 * только огнемёт с целью.
 *
 * Место костра запоминаем в момент, когда он занялся: игрока к этому времени в
 * списке уже нет, а стол успевает пересадить оставшихся.
 */
export const useBurns = (
	controller: GameController,
	getPosition: (playerId: string) => IPoint,
	getSeat: (playerId: string) => number,
): IBurn[] => {
	const {cardEffects} = controller;
	const [burns, setBurns] = React.useState<IBurn[]>([]);
	// Таймеры уборки догоревших костров — тот же приём, что в CardEffect: чистить
	// их из cleanup эффекта нельзя, иначе следующее сожжение отменяет уборку
	// предыдущего и костёр горит на столе до конца партии.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	const lastSeq = React.useRef(0);
	// Первый проход только запоминает номер: пришедшему в середину партии не
	// нужно догонять чужие сожжения разом.
	const isFirstRun = React.useRef(true);

	const latestSeq = reduce(cardEffects, (acc: number, {seq}) => Math.max(acc, seq), 0);

	React.useEffect(() => {
		if (isFirstRun.current) {
			isFirstRun.current = false;
			lastSeq.current = latestSeq;
			return;
		}

		const fresh = filter(cardEffects, ({seq, cardId, targetPlayerId}) =>
			seq > lastSeq.current && cardId === EEventID.flamethrower && !!targetPlayerId);
		lastSeq.current = latestSeq;
		if (!fresh.length) return;

		// Рёв огнемёта заводим здесь же, вместе с пружиной костра: звук расписан по
		// тем же burnMs / jetPart / burnDelay, что и картинка (см.
		// scripts/genFlamethrowerSound.ts), и разъезжаться им нельзя.
		playFlamethrower();

		const started = map(fresh, ({seq, playerId: offensePlayerId, targetPlayerId}): IBurn => {
			const playerId = targetPlayerId ?? '';
			const {x, y} = getPosition(playerId);
			const {x: fromX, y: fromY} = getPosition(offensePlayerId);
			return {seq, playerId, x, y, fromX, fromY, seat: getSeat(playerId)};
		});

		setBurns(current => [...current, ...started]);
		const startedSeqs = map(started, ({seq}) => seq);
		const timer = setTimeout(() => {
			setBurns(current => filter(current, ({seq}) => !includes(startedSeqs, seq)));
			cleanupTimers.current = filter(cleanupTimers.current, item => item !== timer);
		}, burnMs);
		cleanupTimers.current.push(timer);
	}, [latestSeq]);

	return burns;
};

interface IBurningPlayersProps {
	burns: IBurn[];
	controller: GameController;
	badgeRadius: number;
	dim: IDimRect;
	// Соседи горящего — по одному списку на костёр.
	glintsOf: (burn: IBurn) => IPoint[];
}

const BurningPlayers = ({burns, controller, badgeRadius, dim, glintsOf}: IBurningPlayersProps) => (
	<React.Fragment>
		{map(burns, burn => (
			<BurningPlayer
				key={burn.seq}
				burn={burn}
				controller={controller}
				badgeRadius={badgeRadius}
				dim={dim}
				glints={glintsOf(burn)}
			/>
		))}
	</React.Fragment>
);

export default BurningPlayers;
