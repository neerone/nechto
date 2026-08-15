import React from 'react';
import {clamp, clone, each, filter, includes, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {config, interpolate, useSpring, useTransition} from 'react-spring/universal';
import {
	badgeAspect,
	deckCardWidth,
	degToRag,
	isFarSeat,
	playerRoomDiag,
	roomPlayerAngle,
	roomPlayerOrder,
	roomPlayerPoint,
	roomRadii,
	tableCardPoint,
	tableLift,
	tableRadii,
	tableThickness,
	unwrapAngle,
} from 'client/helpers/roomHelpers';
import {arrowPath} from 'client/helpers/arrowPath';
import GameController from 'client/controllers/gameController';
import PlayerBadge, {badgeBodyWidth, PlayerShadow} from 'client/components/table/PlayerBadge/PlayerBadge';
import TableSurface from 'client/components/table/Room/TableSurface';
import CardFlights from 'client/components/table/Room/CardFlight';
import CardDraws from 'client/components/table/Room/CardDraw';
import CardEffects from 'client/components/table/Room/CardEffect';
import BurningPlayers, {useBurns} from 'client/components/table/Room/Burn';
import Deflections, {useDeflects} from 'client/components/table/Room/Deflect';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {cardColor, cardImage, tradeColor} from 'client/helpers/cardVisuals';
import {cardAspectRatio} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {Container, Sprite} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import Reticle from 'client/components/pixiPrimitives/Reticle';
import {emojiTexture} from 'client/helpers/emojiTexture';
import {getWindowHeight, getWindowWidth, tableCenterX, tableCenterY} from 'client/helpers/window';
import type {IPlayersMap} from 'client/controllers/socketTypes';
import type {IFormatTradeContext} from 'shared/interfaces/common';
import type Player from 'client/models/Player';

interface IRoomProps {
	controller: GameController;
	// Что лежит НА столе: колода и сработавшая паника. Приходят детьми, потому
	// что стол рисуется слоями по глубине — дальние игроки, столешница, всё
	// лежащее на ней, ближние игроки, — и вставить их надо ровно в середину.
	children?: React.ReactNode;
}

interface IPoint {
	x: number;
	y: number;
}

// Кружок игрока: угол его места за столом, удаление от центра (им кружок
// вырастает из стола и им же уходит выбывший) и прозрачность.
interface IBadgeLayout {
	angle: number;
	spread: number;
	alpha: number;
}

// Место за столом, как его отдаёт useTransition: кто сидит, ключ перехода и его
// анимируемые поля.
interface ISeat {
	item: string;
	key: string;
	props: IBadgeLayout;
}

// Насколько дальше своего места за столом уезжает кружок выбывшего: он уходит
// от стола наружу, за край экрана ему при этом лететь незачем.
const leaveShare = 2.2;

// Размер карты действия на стрелке и радиус значка обмена — в долях радиуса
// бейджа. Карта не должна съедать саму стрелку: соседи по столу сидят близко.
const arrowIconShare = 0.55;
// Значок обмена: радиус кружка в долях радиуса бейджа, цвет подложки и шрифты,
// в которых у эмодзи есть цветной глиф. Значок мелкий нарочно: он висит на
// стрелке между двумя кружками, и крупный сам становится третьим лицом за
// столом — стрелки из-за него не видно.
const tradeIconShare = 0.3;
const tradeIconBackground = 0x14110c;
// Взаимные действия карту на стрелке не показывают: у обмена она вообще скрыта,
// а смена мест — это не «применили карту к игроку», а договорённость. Поэтому у
// них свои значки: «по рукам» и «поменялись».
const handshakeEmoji = '\u{1F91D}';
const swapEmoji = '\u{1F504}';
const fireEmoji = '\u{1F525}';
// Подсмотр чужих карт: пока смотрящий не закроет окно с ними, на столе висит
// стрелка с лупой — от него к тому, кого он разглядывает.
const magnifierEmoji = '\u{1F50D}';

interface IArrowShape {
	ax: number;
	ay: number;
	bx: number;
	by: number;
	mid1X: number;
	mid1Y: number;
	mid2X: number;
	mid2Y: number;
	arrowX: number;
	arrowY: number;
	arrowRotation: number;
	arrowHeight: number;
	// Середина стрелки: там показывается карта, которой ходят (или значок обмена).
	midX: number;
	midY: number;
	iconSize: number;
	arrowColor: number;
}

// Место игрока за столом (координаты относительно центра — его подставляет
// контейнер). Сама геометрия круга живёт в roomHelpers: по ней же рука считает,
// откуда прилетает и куда улетает карта обмена.
const getPositionFromPlayerList = ({players, playerId, playerList}: {players: IPlayersMap, playerId: string, playerList: string[]}): IPoint => {
	const player = players[playerId];
	if (!player) return {x: 0, y:0};
	return roomPlayerPoint(playerId, playerList);
}

// Значок действия на стрелке: он читается издалека лучше, чем миниатюра карты.
// Если у типа хода значка нет, на стрелке показывается сама карта, которой ходят.
const getArrowEmoji = ({type}: IFormatTradeContext): string | undefined => {
	switch (type) {
		case ETurnContextType.trade:
		case ETurnContextType.chainReaction:
			return handshakeEmoji;
		case ETurnContextType.positionswap:
			return swapEmoji;
		case ETurnContextType.burn:
			return fireEmoji;
		case ETurnContextType.cardsView:
			return magnifierEmoji;
		default:
			return undefined;
	}
}

// Цвет стрелки — цвет карты, которой ходят. Обмен идёт без открытой карты, у
// цепной реакции карта своя — паника, с которой всё началось.
const getArrowColor = ({type, cardId}: IFormatTradeContext): number => {
	if (cardId) return cardColor(cardId);
	if (type === ETurnContextType.chainReaction) return cardColor(EPanicID.chainReaction);
	return tradeColor;
}

interface ILineAnimationArgs {
	context: IFormatTradeContext;
	newPlayerList: string[];
	badgeRadius: number;
	players: IPlayersMap;
}

// Соседи ли по кругу: между ними никто не сидит. Только таких стрелка может
// обходить дугой — под не соседями промежуток занят третьим игроком.
const isNeighbourSeats = (playerList: string[], a: string, b: string): boolean => {
	const count = playerList.length;
	const from = playerList.indexOf(a);
	const to = playerList.indexOf(b);
	if (from < 0 || to < 0 || from === to || count < 2) return false;
	const step = Math.abs(from - to);
	return step === 1 || step === count - 1;
};

const lineAnimation = ({context, newPlayerList, badgeRadius, players}: ILineAnimationArgs): IArrowShape => {
	const {offensePlayerId, defensePlayerId} = context;
	const offenseId = offensePlayerId ?? '';
	const defenseId = defensePlayerId ?? '';

	const from = getPositionFromPlayerList({players, playerId: offenseId, playerList: newPlayerList});
	const to = getPositionFromPlayerList({players, playerId: defenseId, playerList: newPlayerList});

	// Сама геометрия пути живёт в helpers/arrowPath: там же она и проверяется —
	// стол в тесте не поднять, а расходиться этим двум расчётам нельзя.
	const path = arrowPath({
		from,
		to,
		isNeighbours: isNeighbourSeats(newPlayerList, offenseId, defenseId),
		badgeRadius,
		iconRadius: badgeRadius * tradeIconShare,
	});

	return {
		...path,
		iconSize: badgeRadius * arrowIconShare,
		arrowColor: getArrowColor(context),
	}
}


// Ключ стрелки — всё её действие целиком, а не один атакующий: с ключом по
// атакующему следующий его обмен попадал в тот же элемент перехода, и если тот
// подвис, новая стрелка не появлялась вовсе — стол показывал старую.
const arrowKey = ({offensePlayerId, defensePlayerId, type}: IFormatTradeContext): string =>
	`${offensePlayerId ?? ''}>${defensePlayerId ?? ''}:${type}`;

interface ITradeArrowProps {
	item: IFormatTradeContext;
	target: IArrowShape;
	badgeRadius: number;
	isLive: boolean;
}

// Каждая стрелка живёт сама по себе: появляется, когда её действие есть в
// контексте хода, и гаснет, когда оно закончилось. Раньше этим заведовал общий
// useTransition, но он то не убирал отживший элемент (стрелка оставалась висеть
// навсегда), то отдавал его новому действию с тем же ключом — и тогда новая
// стрелка не появлялась вовсе. Здесь показывать нечего, кроме того, что сейчас
// в контексте.
const TradeArrow = ({item, target, badgeRadius, isLive}: ITradeArrowProps) => {
	// Стрелка вырастает из атакующего и в него же схлопывается, когда гаснет.
	const collapsed = {...target, bx: target.ax, by: target.ay, mid1X: target.ax, mid1Y: target.ay,
		mid2X: target.ax, mid2Y: target.ay, arrowX: target.ax, arrowY: target.ay, arrowHeight: 0,
		midX: target.ax, midY: target.ay, iconSize: 0, fade: 0};
	// Цвет держим внутри пружины, хотя он и не меняется: animated() перерисовывает
	// примитив каждый кадр ОДНИМИ анимируемыми пропсами, и статичный цвет до него
	// просто не доезжает — линия получается чёрной.
	const shape = useSpring<IArrowShape & {fade: number}>({
		...target,
		fade: isLive ? 1 : 0,
		from: collapsed,
		config: config.stiff,
	});
	const {midX, midY, iconSize, fade, ...arrowProps} = shape;
	const emoji = getArrowEmoji(item);
	const actionImage = emoji ? undefined : cardImage(item.cardId);
	return (
		<AnimatedPixi.Container alpha={fade}>
			<AnimatedPixi.Arrow {...arrowProps}/>
			{actionImage ? (
				// Карта, которой ходят, — прямо на стрелке: видно, что применили.
				<AnimatedPixi.Sprite
					texture={getPixiTexture(actionImage)}
					anchor={0.5}
					x={midX}
					y={midY}
					width={iconSize}
					height={iconSize.interpolate(size => size * cardAspectRatio)}
				/>
			) : (
				// Значок на кружке цвета стрелки: на тёмном столе один эмодзи без
				// подложки теряется. Двигается контейнер, а его содержимое
				// статично — так стол не перерисовывает круги и эмодзи покадрово.
				<AnimatedPixi.Container x={midX} y={midY}>
					<Circle r={badgeRadius * tradeIconShare} color={getArrowColor(item)}/>
					<Circle r={badgeRadius * tradeIconShare * 0.84} color={tradeIconBackground}/>
					<Sprite
						texture={emojiTexture(emoji ?? handshakeEmoji)}
						anchor={0.5}
						width={badgeRadius * tradeIconShare * 1.15}
						height={badgeRadius * tradeIconShare * 1.15}
					/>
				</AnimatedPixi.Container>
			)}
		</AnimatedPixi.Container>
	);
};

// Прицел на том, чей сейчас ход. Раньше ходящего отмечала зелёная точка на
// макушке кружка — её на столе было не найти, а на полном столе она к тому же
// горела сразу у двоих: в обмене не в idle оба его участника. Прицел один, и
// он наводится ровно на того, чей ход (turnPlayerId).
const reticleColor = 0x00FF00;
// Раствор прицела в долях радиуса бейджа: наведённый и в момент наводки.
const reticleAimedShare = 1.3;
const reticleWideShare = 2.6;
// Плечо уголка — в долях самого раствора, чтобы уголки не смыкались в рамку.
const reticleArmShare = 0.4;
// Скругление угла — в долях плеча.
const reticleCornerShare = 0.5;
// Толщина уголков — в долях радиуса бейджа: на большом экране кружки крупные,
// и линия в пару пикселей на них теряется. Но прицел — рамка, а не обводка:
// толстая линия спорит с самим кружком.
const reticleThicknessShare = 0.03;
const reticleMinThickness = 1;
const reticleMaxThickness = 2.5;
// Сколько прицел сжимается на новой цели. Едет он к ней своей пружиной: как
// быстро — дело расстояния, а сжимается всегда одинаково.
const reticleAimMs = 380;
// Наведённый прицел дышит: чуть разжимается и сжимается обратно. Стоящая на
// столе рамка выглядит забытой, а дыхание показывает, что ход всё ещё тут.
const reticleBreathScale = 1.07;
const reticleBreathMs = 1300;

interface ITurnReticleProps {
	// Место цели: пока прицел до неё едет, она может и уехать сама.
	x: number;
	y: number;
	badgeRadius: number;
	// Цель. Меняется — прицел наводится заново.
	playerId: string;
}

const TurnReticle = ({x, y, badgeRadius, playerId}: ITurnReticleProps) => {
	// Переезд к новой цели: своей пружиной, поэтому прицел догоняет и того, кто
	// сам переехал (смена мест), а не только смену хода. Поля названы не x/y:
	// react-spring считает такие пружины svg-атрибутами и типизирует их не
	// числами, а долями оборота.
	const move = useSpring<{aimX: number, aimY: number}>({aimX: x, aimY: y, config: config.stiff});
	// Наводка: прицел приходит широко раскрытым и сжимается на цели. Сжимается
	// он масштабом контейнера, а не собственным раствором: animated() гонит в
	// примитив ОДНИ анимируемые пропы, и постоянные толщина с цветом до него бы
	// не доехали — уголки вышли бы нулевой ширины (той же граблей опасается
	// стрелка обмена, см. TradeArrow).
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
	return (
		<AnimatedPixi.Container x={move.aimX} y={move.aimY}>
			<AnimatedPixi.Container scale={aim.aimScale}>
				<AnimatedPixi.Container scale={breath.breathScale}>
					<Reticle
						spread={spread}
						arm={spread * reticleArmShare}
						cornerRadius={spread * reticleArmShare * reticleCornerShare}
						thickness={clamp(badgeRadius * reticleThicknessShare, reticleMinThickness, reticleMaxThickness)}
						color={reticleColor}
					/>
				</AnimatedPixi.Container>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
};

// Сколько уходящая стрелка ещё висит на столе, растворяясь.
const arrowFadeMs = 400;

// Стрелки, которые сейчас надо рисовать: все действия из контекста хода плюс
// те, что только что закончились — им дают короткое время растаять.
const useArrows = (tradeContext: IFormatTradeContext[]) => {
	const [leaving, setLeaving] = React.useState<IFormatTradeContext[]>([]);
	const shownBefore = React.useRef<IFormatTradeContext[]>([]);
	// Таймеры уборки снимаем только при размонтировании: чистить их из cleanup
	// эффекта нельзя, иначе следующее действие отменяет уборку предыдущего.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);

	const liveKeys = map(tradeContext, arrowKey);
	const signature = liveKeys.join('|');

	React.useEffect(() => {
		const gone = filter(shownBefore.current, (context) => !liveKeys.includes(arrowKey(context)));
		shownBefore.current = map(tradeContext, (context) => context);
		if (!gone.length) return;
		setLeaving((current) => [...current, ...gone]);
		const goneKeys = map(gone, arrowKey);
		const timer = setTimeout(() => {
			setLeaving((current) => filter(current, (context) => !goneKeys.includes(arrowKey(context))));
			cleanupTimers.current = filter(cleanupTimers.current, (item) => item !== timer);
		}, arrowFadeMs);
		cleanupTimers.current.push(timer);
	}, [signature]);

	// Вернувшееся действие рисуем как живое, а не как уходящее.
	return [
		...map(tradeContext, (context) => ({context, isLive: true})),
		...map(filter(leaving, (context) => !liveKeys.includes(arrowKey(context))), (context) => ({context, isLive: false})),
	];
};

const Room = observer(({controller, children} : IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players, turnPlayerId } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;
	const {marks} = currentPlayer;
	const tradeContext: IFormatTradeContext[] = controller.tradeContext || [];

	// Рассадка и места предыдущего рендера. Сожжение приходит ровно тем же
	// обновлением, которым сгоревший уходит со стола, — а стол на нём уже успел
	// бы пересадить оставшихся. Костру нужна прежняя рассадка целиком: и куда
	// бить струёй, и откуда, и на какое место вернуть горящего.
	const lastPositions = React.useRef<Record<string, IPoint>>({});
	const prevPositions = React.useRef<Record<string, IPoint>>({});
	const lastSeats = React.useRef<string[]>([]);
	const prevSeats = React.useRef<string[]>([]);
	const positionBefore = (playerId: string): IPoint => prevPositions.current[playerId] ?? {x: 0, y: 0};
	const seatBefore = (playerId: string): number => prevSeats.current.indexOf(playerId);

	const burns = useBurns(controller, positionBefore, seatBefore);
	const burningIds = map(burns, ({playerId}) => playerId);

	// Пока человек горит, стол стоит: сгоревший остаётся на своём месте, и никто
	// не пересаживается. Сожжение — событие, его дают разглядеть, а не подменяют
	// место соседним игроком в ту же секунду. Сам сгоревший смотрит на свой
	// костёр с того же места, что и сидел: разворачивать под него стол (мёртвым
	// его показывают иначе) на время костра тоже рано.
	const isBurningSelf = includes(burningIds, currentPlayerId);
	// Обычно рассадка — сам playersList, как он пришёл с сервера: стол один и тот
	// же у всех, кто на него смотрит. «От первого лица» его разворачивают так,
	// чтобы смотрящий сидел первым; сгоревшего в списке уже нет, поэтому пока
	// горит он сам, стол держат за его соседа — того, кто сидел за ним, — и сам
	// сгоревший встаёт перед ним обратно на своё нулевое место. Сам разворот —
	// общий с рукой (см. roomPlayerOrder): по нему же она считает, из чьего
	// кружка прилетает и в чей улетает карта обмена.
	const anchorId = isBurningSelf ? prevSeats.current[1] : currentPlayerId;
	const seatedList = roomPlayerOrder(
		playersList,
		anchorId ?? '',
		controller.isFirstPersonTable && (currentPlayer.turnState !== ETurnState.dead || isBurningSelf),
	);
	const newPlayerList = clone(seatedList);
	each(burns, ({playerId, seat}) => {
		if (includes(newPlayerList, playerId)) return;
		newPlayerList.splice(clamp(seat < 0 ? newPlayerList.length : seat, 0, newPlayerList.length), 0, playerId);
	});

	const playersCount = newPlayerList.length;

	prevPositions.current = lastPositions.current;
	prevSeats.current = lastSeats.current;
	lastPositions.current = {...lastPositions.current};
	lastSeats.current = newPlayerList;
	each(newPlayerList, (playerId) => {
		lastPositions.current[playerId] = getPositionFromPlayerList({players, playerId, playerList: newPlayerList});
	});
	// Место игрока за столом. Последнее известное запоминаем: цель летящей карты
	// может не дожить до конца её полёта.
	const positionOf = (playerId: string): IPoint =>
		lastPositions.current[playerId] ?? getPositionFromPlayerList({players, playerId, playerList: newPlayerList});

	// Отбитые «Никаким шашлыком» струи. Здесь, в отличие от костра, рассадка
	// обычная: никто не выбывает, и места участников никуда не уезжают.
	const deflects = useDeflects(controller, positionOf);

	// Весь холст в координатах стола: им костёр приглушает сцену вокруг себя.
	const dimRect = {
		x: -tableCenterX(),
		y: -tableCenterY(),
		width: getWindowWidth(),
		height: getWindowHeight(),
	};
	// Соседи горящего по столу — на них ложатся отсветы пожара. Рассадка на время
	// костра заморожена, так что места соседей за это время никуда не уедут.
	const glintsOf = ({playerId}: {playerId: string}): IPoint[] => {
		const seat = newPlayerList.indexOf(playerId);
		if (seat < 0 || newPlayerList.length < 2) return [];
		const around = [
			newPlayerList[(seat + 1) % newPlayerList.length],
			newPlayerList[(seat - 1 + newPlayerList.length) % newPlayerList.length],
		];
		return map(filter(around, (id): id is string => !!id && id !== playerId), positionOf);
	};

	// Углы мест, а не координаты: пересаженный игрок должен обойти стол ПО кругу,
	// а не проехать сквозь столешницу по прямой. Пружина ведёт угол, точку из него
	// считает интерполяция ниже.
	//
	// Прежний угол помним: «размотать» новый (352° → 368°, а не → 8° назад через
	// весь стол) можно только относительно него. Заодно он же — угол уходящего,
	// которого в рассадке уже нет.
	const lastAngles = React.useRef<Record<string, number>>({});
	const seatAngle = (playerId: string): number => {
		const deg = unwrapAngle(roomPlayerAngle(playerId, newPlayerList), lastAngles.current[playerId]);
		lastAngles.current[playerId] = deg;
		return deg;
	};
	const angleOf = (playerId: string): number =>
		lastAngles.current[playerId] ?? roomPlayerAngle(playerId, newPlayerList);

	const transitions = useTransition<string, IBadgeLayout>(newPlayerList, playerId => playerId, {
		angle: 90,
		spread: 1,
		alpha: 1,
		// Севший за стол вырастает из его середины.
		from: (playerId: string) => ({angle: seatAngle(playerId), spread: 0, alpha: 1}),
		enter: (playerId: string) => ({angle: seatAngle(playerId), spread: 1, alpha: 1}),
		update: (playerId: string) => ({angle: seatAngle(playerId), spread: 1, alpha: 1}),
		// Выбывший встаёт и уходит из-за стола: его кружок отъезжает со своего
		// места наружу и там гаснет. В центр стола ему нельзя — там колода, и
		// уход выглядел бы как ещё один ход, а не как «игрока больше нет».
		leave: (playerId: string) => ({angle: angleOf(playerId), spread: leaveShare, alpha: 0}),
	});

	const badgeWidth = playerRoomDiag(playersCount);
	const badgeRadius = badgeWidth/2;
	// Круг рассадки и сама столешница. Полуоси берём один раз на рендер: пружина
	// гонит по ним точку каждый кадр, а меняются они только вместе с окном — на
	// него стол пересчитывается целиком (см. viewport).
	const {rx, ry} = roomRadii(playersCount);
	const surface = tableRadii(playersCount);
	const arrows = useArrows(tradeContext);

	// От сгоревшего не остаётся и кружка: когда костёр догорит, игрок уйдёт из
	// рассадки, и обычный уход (кружок отъезжает за стол) выглядел бы так, будто
	// он всё-таки встал и вышел. Поэтому таких помним и не рисуем вовсе.
	const burnedOut = React.useRef<Set<string>>(new Set());
	each(burningIds, (playerId) => burnedOut.current.add(playerId));



	const canPlayerBeSelected = (player: Player): boolean => {
		if (controller.currentAction && controller.currentAction.type === ENotificationAction.playerSelect) {
			return controller.currentAction.playersToSelect.includes(player.id)
		}
		return false;
	}

	const badgeHeight = badgeWidth * badgeAspect;

	// Место игрока за столом: точка считается из угла прямо в пружине, поэтому
	// пересадка идёт по дуге круга, а не по хорде через стол.
	const seatPlace = ({item: playerId, key, props: {angle, spread, alpha}}: ISeat, children: React.ReactNode) => (
		<AnimatedPixi.Container
			key={`${playerId}:${key}`}
			x={interpolate([angle, spread], (deg: number, away: number) => rx * Math.cos(degToRag(deg)) * away)}
			y={interpolate([angle, spread], (deg: number, away: number) => ry * Math.sin(degToRag(deg)) * away)}
			alpha={alpha}
		>
			{children}
		</AnimatedPixi.Container>
	);

	const renderShadow = (seat: ISeat) => {
		const player = players[seat.item];
		if (!player) return null;
		return seatPlace(seat, (
			<PlayerShadow
				badgeWidth={badgeBodyWidth(player.state === EPlayerState.door, badgeWidth, badgeHeight)}
				badgeHeight={badgeHeight}
			/>
		));
	};

	const renderBadge = (seat: ISeat) => {
		const player = players[seat.item];
		if (!player || !player.id) return null;
		const {nickname, color, avatar, state} = player;
		return seatPlace(seat, (
			<PlayerBadge
				style={{width: badgeWidth, height: badgeHeight}}
				nickname={nickname}
				color={color}
				avatar={avatar}
				canBeSelected={canPlayerBeSelected(player)}
				id={player.id}
				isConnected={player.isConnected}
				isYou={player.isYou}
				isInfected={player.isInfected}
				isThing={player.isThing}
				quarantine={player.quarantine}
				isDoor={state === EPlayerState.door}
				onSelect={controller.selectPlayer}
				onLongPress={controller.changePlayerMark}
				mark={marks[player.id]}
			/>
		));
	};

	// Дальняя половина стола — та, что уходит за столешницу: её жильцов рисуют
	// ДО стола, и он подрезает их по грудь. Ближних — после, они стоят перед
	// столом. На этом (вместе со сплюснутой проекцией) и держится объём.
	//
	// Делим по месту, к которому игрок едет, а не по тому, где он сейчас:
	// пересаживающийся сразу становится «ближним» или «дальним» и обходит стол
	// соответственно перед ним или за ним.
	//
	// Горящего рисует его костёр — он же и покажет, что от кружка осталось.
	const seatsOf = (isFar: boolean): ISeat[] => filter(
		transitions as unknown as ISeat[],
		({item}) => !!players[item] && !burnedOut.current.has(item) && isFarSeat(angleOf(item)) === isFar,
	);
	const farSeats = seatsOf(true);
	const nearSeats = seatsOf(false);

	return (
		<Container>
			<Container x={tableCenterX()} y={tableCenterY()}>
				{/* Тени всех — до кружков всех: по кругу соседи стоят вплотную и порой
				    наезжают друг на друга, и тень, нарисованная вместе со своим
				    хозяином, ложилась бы на соседа. */}
				{map(farSeats, renderShadow)}
				{map(farSeats, renderBadge)}
				{/* Стол стоит в середине комнаты — там же, где круг на полу задника
				    (см. RoomBackdrop). Свою высоту он отмеряет сам: столешницу
				    поднимает, тень оставляет на полу. */}
				<TableSurface
					rx={surface.rx}
					ry={surface.ry}
					thickness={tableThickness(playersCount)}
					lift={tableLift(playersCount)}
					isClockwise={controller.isClockwise}
				/>
			</Container>
			{/* Всё, что лежит на столешнице: колода и сработавшая паника (см. Table).
			    Они уже в координатах экрана, поэтому идут без сдвига к центру. */}
			{children}
			<Container x={tableCenterX()} y={tableCenterY()}>
				{map(nearSeats, renderShadow)}
				{map(nearSeats, renderBadge)}
				{/* Прицел — поверх кружков: он обводит цель, а не лежит под ней.
				    Пока ход ни за кем не числится (партия ещё не началась или уже
				    кончилась), наводить его не на кого. Сгоревшего он тоже не ждёт:
				    ход уйдёт дальше, и прицел уедет за ним. */}
				{turnPlayerId && players[turnPlayerId] && !burnedOut.current.has(turnPlayerId) && (
					<TurnReticle
						{...positionOf(turnPlayerId)}
						badgeRadius={badgeRadius}
						playerId={turnPlayerId}
					/>
				)}
				{map(arrows, ({context, isLive}) => (
					<TradeArrow
						key={arrowKey(context)}
						item={context}
						target={lineAnimation({context, newPlayerList, badgeRadius, players})}
						badgeRadius={badgeRadius}
						isLive={isLive}
					/>
				))}
				<CardFlights
					controller={controller}
					getPosition={positionOf}
					cardWidth={badgeWidth * 0.42}
				/>
				{/* Взятие карты из колоды: она лежит на столе, в тех же координатах,
				    что и сам этот контейнер, и той же ширины, что у Deck. */}
				<CardDraws
					controller={controller}
					getPosition={positionOf}
					deckPoint={tableCardPoint(playersCount)}
					deckCardWidth={deckCardWidth(playersCount)}
					badgeRadius={badgeRadius}
				/>
				<CardEffects
					controller={controller}
					getPosition={positionOf}
					badgeRadius={badgeRadius}
				/>
				{/* Рикошет — поверх карты применения: она висит ровно в точке удара и
				    работает зеркалом, от которого пламя уходит прочь. */}
				<Deflections
					deflects={deflects}
					badgeRadius={badgeRadius}
				/>
				{/* Костры — поверх всего: сожжение видно даже сквозь стрелки и летящие карты. */}
				<BurningPlayers
					burns={burns}
					controller={controller}
					badgeRadius={badgeRadius}
					dim={dimRect}
					glintsOf={glintsOf}
				/>
			</Container>
		</Container>
	)
});

export default Room;
