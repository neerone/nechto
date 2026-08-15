import React from 'react';
import {map, range} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import EllipseTexture from 'client/components/pixiPrimitives/EllipseTexture';
import Plate from 'client/components/pixiPrimitives/Plate';
import {tableSquash} from 'client/helpers/roomHelpers';
import {sphereShadeTexture} from 'client/helpers/sphereShade';
import {resources} from 'client/resources/resources';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {toggleCardHintFor} from 'client/components/hint/canvasHint';
import {tradeColor} from 'client/helpers/cardVisuals';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {EEventID} from 'shared/enum/cards';
import {cardAspectRatio, quarantineTurns} from 'shared/constant/cards';

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	avatar: string;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	onLongPress: ((playerId: string) => void) | null;
	quarantine: number;
	isYou: boolean;
	isInfected: boolean;
	isThing: boolean;
	isConnected: boolean;
	mark: EPlayerMark | undefined;
	style: {
		width:number;
		height: number;
	}
}


const playerGlowTexture = getPixiTexture(resources.playerbadgeGlow);
// Дверь на месте игрока — это сама карта «Заколоченная дверь» (см. ниже).
const doorCardTexture = getPixiTexture(resources.barricade);
const disconnectedTexture = getPixiTexture(resources.playerBadges['disconnected']);
/*Marks*/
const playerStatusQuestion = getPixiTexture(resources.playerStatusQuestion);
const playerStatusThing = getPixiTexture(resources.playerStatusThing);
const playerStatusInfected = getPixiTexture(resources.playerStatusInfected);
const playerStatusClear = getPixiTexture(resources.playerStatusClear);

export const formatNickname = (nickname: string | null): string | null => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

// Точки отсчитывают оставшиеся ходы карантина. Нажатие по ним показывает саму
// карту «Карантин»: по жёлтым точкам не догадаться, что именно на игрока сыграли.
// Сами точки крошечные, поэтому область нажатия растягиваем на всю ширину бейджа
// и делаем не тоньше пальца.
const quarantineHitHeight = 30;
// Точки сидят на «лбу» кружка — в долях его полувысоты вверх от середины. Ниже
// им мешают подпись с пометкой, выше они сползают с самого кружка.
const quarantineDotsLift = 0.58;

interface IQuarantineProps {
	quarantine: number;
	// Габариты кружка: он вытянут по вертикали (см. badgeAspect), поэтому точки
	// разложены по его ширине, а опущены — по его высоте.
	badgeWidth: number;
	badgeHeight: number;
	isInteractive: boolean;
}

const Quarantine = ({quarantine, badgeWidth, badgeHeight, isInteractive}: IQuarantineProps) => {
	const r = (badgeWidth / 2) * 0.05;
	const yOffset = -(badgeHeight / 2) * quarantineDotsLift;
	const xOffset = r * 4;
	if (!quarantine) return null;
	const hitWidth = Math.max(badgeWidth / 2, r * 4 * quarantine);
	const hitArea = new PIXI.Rectangle(-hitWidth / 2, yOffset - quarantineHitHeight / 2, hitWidth, quarantineHitHeight);
	// Плашка под точками: на «лбу» под ними теперь сама карта карантина (см.
	// QuarantineSkin), и жёлтое по её пёстрой картинке не читается.
	//
	// Длина у неё всегда во весь карантин, а не по оставшимся точкам: это шкала,
	// и убывать должны только точки на ней. Иначе с каждым ходом карантинного
	// плашка сама укорачивалась бы — и то, сколько ему осталось, приходилось бы
	// считать точки, а не видеть.
	const scale = Math.max(quarantine, quarantineTurns);
	const left = -xOffset - r;
	const right = (scale - 1) * r * 4 - xOffset + r;
	return (
		<Container
			interactive={isInteractive}
			buttonMode={isInteractive}
			hitArea={hitArea}
			pointerdown={(event: PIXI.interaction.InteractionEvent) => isInteractive
				? toggleCardHintFor(EEventID.quarantine, event)
				: null}
		>
			<Container x={(left + right) / 2} y={yOffset}>
				<Plate
					plateWidth={right - left + r * 3}
					plateHeight={r * 5}
					borderRadius={r * 2.5}
					color={youPlateColor}
				/>
			</Container>
			{ map(range(quarantine), (_q, index) => {
				return <Circle key={index} xCoord={(index * r * 4) - xOffset } yCoord={yOffset} color={0xFFFF00} r={r}/>
			})}
		</Container>
	);
}

// Подпись на кружке. У всех она белая по тёмной подложке, а свой ник — жирный и
// золотой: за абсолютным столом (см. roomPlayerOrder) сидишь ты где угодно, а не
// всегда внизу, и себя надо находить взглядом. Одним только ником себя не найти —
// он такой же, как у соседей. Золото берём то же, что у стрелки обмена
// (tradeColor): на столе это уже цвет «своего» действия, а по тёмной подложке он
// выделяется, не споря с зелёным прицелом ходящего.
const nicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fill: 0xFFFFFF, align: 'center'});
const youNicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: tradeColor, align: 'center'});
const youPlateColor = 0x14110C;
// Поля подложки вокруг букв и её скругление в долях высоты: половина — и края
// выходят полукруглыми.
const youPlatePadX = 7;
const youPlatePadY = 3;
const youPlateRadiusShare = 0.5;
// Насколько подпись опущена от середины кружка — в долях его высоты. По центру
// она ложилась ровно на лицо: под кружком теперь лицо игрока (а у кого-то ещё и
// карта статуса), и подпись закрывала как раз то, по чему игрока и узнают. Вниз
// её при этом уводим чуть-чуть: у самого края эллипс сужается, и подложка
// длинного ника выходит за кружок, а сама подпись перестаёт читаться как часть
// игрока и повисает под ним.
const nicknameDrop = 0.1;

// Ник на подложке. Подложку меряем по самим буквам, а не по кружку: ники бывают
// от одной буквы до четырёх (см. formatNickname), и подложка на глаз то жала бы
// длинный, то болталась вокруг короткого.
const PlatedNickname = ({text, style, y}: {text: string, style: PIXI.TextStyle, y: number}) => {
	const {width, height} = PIXI.TextMetrics.measureText(text, style);
	const plateHeight = height + youPlatePadY * 2;
	return (
		<Container y={y}>
			<Plate
				plateWidth={width + youPlatePadX * 2}
				plateHeight={plateHeight}
				borderRadius={plateHeight * youPlateRadiusShare}
				color={youPlateColor}
			/>
			<Text text={text} anchor={0.5} style={style}/>
		</Container>
	);
};

/**
 * Статус игрока виден по самому кружку: на него натянута та карта, которой его
 * таким сделали. Раньше карантинный кружок просто гас до сорока процентов (и
 * читался как отключившийся), а роль показывали отдельно нарисованные круглые
 * бейджи — те же карты, но перерисованные заново и живущие своей жизнью.
 *
 * Карта вписана ровно в эллипс (см. EllipseTexture), поэтому она лежит НА
 * игроке, а не прямоугольной наклейкой поверх стола вокруг него. В кадр берём не
 * всю карту с заголовком и правилами (в кружок они всё равно не читаются), а
 * только её иллюстрацию — доли размеров картинки, а не пиксели: карты могут
 * перерисовать в другом разрешении.
 *
 * Кадр «Карантина» подобран так, чтобы голова на кружке выходила примерно того
 * же размера, что и лицо игрока под ней.
 *
 * У роли и заражения карт нет: они нарисованы сразу под кружок (см.
 * resources.thingAvatar и resources.infectedAvatars) и берутся целиком —
 * кадрировать нечего, картинки уже собраны как надо.
 */
const wholePicture = {x: 0, y: 0, width: 1, height: 1};
const statusSkins = {
	thing: {texture: getPixiTexture(resources.thingAvatar), focus: wholePicture},
	quarantine: {texture: getPixiTexture(resources.quarantine), focus: {x: 0.09, y: 0.27, width: 0.68, height: 0.58}},
};

// Заражённое лицо — то же самое лицо игрока, только со щупальцами: по кружку
// видно и что человек заражён, и кто он. Скины собраны заранее и лежат готовыми:
// EllipseTexture перерисовывает заливку, когда ей приходит другой focus, а на
// новом объекте на каждый рендер она перерисовывалась бы всё время.
const infectedSkins = map(resources.infectedAvatars, (image) => ({
	texture: getPixiTexture(image),
	focus: wholePicture,
}));

interface IStatusArgs {
	isConnected: boolean;
	isThing: boolean;
	isInfected: boolean;
	quarantine: number;
	// Номер лица игрока (см. avatarTextureOf): по нему берётся и заражённое.
	avatar: string;
}

/**
 * Что натянуть на кружок. Роль важнее карантина: карантин пройдёт через три
 * хода, а нечто останется нечто — и знающему о роли важнее видеть именно её.
 * Отключившегося не закрываем ничем: то, что человека нет за столом, важнее
 * всего остального, что можно о нём сказать.
 *
 * Заражённое лицо — единственный статус, у которого своя картинка на каждого:
 * без номера лица (до старта партии его ещё нет) показывать нечего, и кружок
 * остаётся чистым.
 */
const statusSkinOf = ({isConnected, isThing, isInfected, quarantine, avatar}: IStatusArgs) => {
	if (!isConnected) return null;
	if (isThing) return statusSkins.thing;
	if (isInfected) return avatar === '' ? null : (infectedSkins[Number(avatar) % infectedSkins.length] ?? null);
	if (quarantine > 0) return statusSkins.quarantine;
	return null;
};

export const StatusSkin = ({badgeWidth, badgeHeight, ...status}: IStatusArgs & {badgeWidth: number, badgeHeight: number}) => {
	const skin = statusSkinOf(status);
	if (!skin) return null;
	return (
		<EllipseTexture
			rx={badgeWidth / 2}
			ry={badgeHeight / 2}
			texture={skin.texture}
			focus={skin.focus}
		/>
	);
};

/**
 * Светотень поверх кружка — одна на всех: и на цветных бейджах, и на картах
 * статусов. Свет у всех идёт с одной стороны (сверху слева), и край у всех
 * одинаково уходит в темноту, а не режется по столу яркой границей.
 * Накладывается последней из картинок: ник, точки карантина и пометка ложатся
 * уже поверх неё.
 */
export const BadgeShade = ({badgeWidth, badgeHeight}: {badgeWidth: number, badgeHeight: number}) => (
	<Sprite
		texture={sphereShadeTexture()}
		anchor={0.5}
		width={badgeWidth}
		height={badgeHeight}
	/>
);

// Тень под игроком. Без неё кружок висит над столом, а не стоит у него: пол
// (и столешница, на которую тень заходит у ближних мест) — это та же плоскость,
// что и стол, поэтому и тень лежит в его проекции, сплюснутым эллипсом.
//
// Двумя кольцами: снаружи пожиже, внутри плотнее — у одного сплошного эллипса
// слишком резкий край, и он читается лужей, а не тенью.
//
// Шире самого кружка тень не растекается: за столом соседи стоят вплотную, и
// лишний её край наползал бы на соседнее «яйцо». По той же причине Room рисует
// все тени до всех кружков (см. renderShadow).
const badgeShadows = [
	{spread: 0.5, alpha: 0.3},
	{spread: 0.35, alpha: 0.35},
];
// Насколько тень приплюснута сверх проекции стола (она лежит, а не стоит) и где
// она начинается — в долях высоты кружка от его середины.
const shadowFlatten = 0.42;
const shadowDrop = 0.44;

export const PlayerShadow = ({badgeWidth, badgeHeight}: {badgeWidth: number, badgeHeight: number}) => (
	<Container interactiveChildren={false}>
		{map(badgeShadows, ({spread, alpha}) => (
			<Ellipse
				key={spread}
				yCoord={badgeHeight * shadowDrop}
				rx={badgeWidth * spread}
				ry={badgeWidth * spread * tableSquash * shadowFlatten}
				color={0x000000}
				alpha={alpha}
			/>
		))}
	</Container>
);

/**
 * Ширина того, чем занято место за столом. Дверь — не игрок, а сыгранная между
 * соседями карта «Заколоченная дверь»: её и рисуем самой картой, прямоугольником
 * и в карточных пропорциях, а не кружком в чужой шкуре. Высота у неё та же, что
 * у кружков, — место за столом выглядит занятым ровно так же.
 *
 * Наружу — потому что тени рисует стол, отдельным проходом (см. Room), а ему
 * тоже надо знать, чему он их подкладывает.
 */
export const badgeBodyWidth = (isDoor: boolean, width: number, height: number): number =>
	isDoor ? height / cardAspectRatio : width;

/**
 * Цвет кружка — на случай, когда лица ещё нет: аватарку раздаёт сервер на старте
 * партии (см. gameStarter), а до того игрок за столом уже сидит.
 *
 * Раньше цвет был картинкой с запечённым в неё градиентом — свет в ней был
 * нарисован заранее и спорил со светом сферы, которая ложится сверху (см.
 * sphereShadeTexture). Сами цвета — средние тона тех самых картинок.
 *
 * Цвет — это порядковый номер игрока, поэтому на столе больше badgeColors
 * человек цвета начинают повторяться, но цвет есть у всех.
 */
const firstBadgeColor = 0x99693E;
const badgeColors = [
	firstBadgeColor, 0x998E3E, 0x99AD3E, 0x7DB13E, 0x51B14F, 0x51B185,
	0x518C86, 0x586986, 0x7D6986, 0x996979, 0x996963,
];
// Отключившийся сидит серым камнем: цвет ему больше не нужен — важно, что
// человека за столом нет.
const disconnectedColor = 0x3B3833;
// Во сколько раз значок оборванного провода меньше самого кружка.
const disconnectedIconShare = 0.62;

// Цвет приходит числом в строке, но приходит он с сервера: на мусор в нём
// отвечаем первым цветом, а не чёрной дырой на месте игрока.
export const badgeColorOf = (color: string): number =>
	badgeColors[Number(color) % badgeColors.length] ?? firstBadgeColor;

// Лица игроков. Кадрированы под пропорции кружка (см. badgeAspect), поэтому в
// него вписываются целиком — кадрировать их ещё и здесь, как карты статусов, не
// приходится.
const avatarTextures = map(resources.avatars, getPixiTexture);

// Лицо игрока по номеру, присланному сервером. Пока номера нет (до старта партии)
// или он не из этого списка — лица нет, и кружок остаётся цветным.
const avatarTextureOf = (avatar: string): PIXI.Texture | undefined =>
	avatar === '' ? undefined : avatarTextures[Number(avatar) % avatarTextures.length];

interface IBadgeBodyProps {
	isDoor: boolean;
	isConnected: boolean;
	color: string;
	avatar: string;
	badgeWidth: number;
	badgeHeight: number;
	// Нажатие по самому кружку: выбор цели или показ карты двери. Всегда
	// определённое — prop со значением undefined react-pixi-fiber не применяет, а
	// печатает «ignoring prop» на каждый рендер (см. Card).
	isInteractive?: boolean;
	pointerdown?: (event: PIXI.interaction.InteractionEvent) => void;
}

const noop = () => {};

/**
 * Само тело кружка — то, на что ложатся картинка статуса и сфера. Роли здесь
 * нет: нечто и заражённого показывает натянутая картинка (см. StatusSkin), а не
 * круглый бейдж поверх кружка, живущий своей жизнью.
 *
 * Наружу — потому что горящий игрок (см. Burn) сгорает ровно тем же кружком,
 * каким сидел за столом.
 */
export const BadgeBody = ({
	isDoor,
	isConnected,
	color,
	avatar,
	badgeWidth,
	badgeHeight,
	isInteractive = false,
	pointerdown = noop,
}: IBadgeBodyProps) => {
	// Дверь — не игрок, а лежащая на месте соседей карта: она и рисуется картой.
	if (isDoor) {
		return (
			<Sprite
				texture={doorCardTexture}
				anchor={0.5}
				width={badgeWidth}
				height={badgeHeight}
				interactive={isInteractive}
				buttonMode={isInteractive}
				pointerdown={pointerdown}
			/>
		);
	}
	// Живой игрок сидит за столом своим лицом. Отключившийся — серым камнем со
	// значком оборванного провода: то, что человека за столом нет, важнее того,
	// как он выглядел.
	const face = isConnected ? avatarTextureOf(avatar) : undefined;
	return (
		<React.Fragment>
			{face ? (
				<EllipseTexture
					rx={badgeWidth / 2}
					ry={badgeHeight / 2}
					texture={face}
					interactive={isInteractive}
					buttonMode={isInteractive}
					pointerdown={pointerdown}
				/>
			) : (
				<Ellipse
					rx={badgeWidth / 2}
					ry={badgeHeight / 2}
					color={isConnected ? badgeColorOf(color) : disconnectedColor}
					interactive={isInteractive}
					buttonMode={isInteractive}
					pointerdown={pointerdown}
				/>
			)}
			{!isConnected && (
				<Sprite
					texture={disconnectedTexture}
					anchor={0.5}
					width={badgeWidth * disconnectedIconShare}
					height={badgeWidth * disconnectedIconShare}
				/>
			)}
		</React.Fragment>
	);
};

const getMarkTexture = (mark: EPlayerMark | undefined): PIXI.Texture | undefined => {
	switch (mark) {
		case EPlayerMark.question:
			return playerStatusQuestion;
		case EPlayerMark.infected:
			return playerStatusInfected;
		case EPlayerMark.thing:
			return playerStatusThing;
		case EPlayerMark.clear:
			return playerStatusClear;
		default:
			return undefined;
	}
}

const PlayerBadge = ({
		nickname,
		color,
		avatar,
		canBeSelected = false,
		onSelect = null,
		id,
		isDoor,
		quarantine,
		isYou,
		isInfected,
		isThing,
		isConnected,
		style,
		onLongPress = null,
		mark,
	}: IPlayerBadgeProps) => {
/*	const longPress = useLongPress(() => {
	});*/
	// Роль видна по самому бейджу — своей пометкой такого игрока помечать нечего.
	const isRoleKnown = !isDoor && isConnected && (isThing || isInfected);
	const markPlayer = () => {
		if (canBeSelected || isYou || isRoleKnown) return;
		onLongPress && onLongPress(id);
	}

	// Дверь — это не игрок, а лежащая на столе карта «Заколоченная дверь»:
	// нажатие по ней показывает саму карту. Пока дверь можно выбрать целью
	// (топор), выбор важнее подсказки.
	const onBadgePointerDown = (event: PIXI.interaction.InteractionEvent) => {
		if (canBeSelected) {
			onSelect && onSelect(id);
			return;
		}
		if (isDoor) toggleCardHintFor(EEventID.barricade, event);
	};

	// NOTE: цвет приходит только после gameStarter (до старта он ''), а без него
	// кружок нечем залить.
	if (!color && !isDoor) return null;
	const bodyWidth = badgeBodyWidth(isDoor, style.width, style.height);
	// На кружке у всех ник, включая свой: что кружок твой, говорит этикетка над
	// ним (см. YouTag), а раньше вместо ника там стояло «ТЫ» — и собственное имя
	// за столом было не найти.
	//
	// Пустая строка, а не undefined: prop со значением undefined react-pixi-fiber
	// не применяет, а печатает «ignoring prop» на каждый рендер бейджа.
	const nick = formatNickname(nickname) ?? ''
	return (
		<Container pointerdown={markPlayer} buttonMode={true} interactive={true}>
			{canBeSelected && (
				<Sprite
					texture={playerGlowTexture}
					anchor={0.5}
					width={bodyWidth * 1.35}
					height={style.height * 1.35}
				/>
			)}

			{/* Кружок игрока — эллипс, а не круг: он стоит за столом, который мы
			    видим из-за его края, и вытянут по вертикали (см. badgeAspect). */}
			<BadgeBody
				isDoor={isDoor}
				isConnected={isConnected}
				color={color}
				avatar={avatar}
				badgeWidth={bodyWidth}
				badgeHeight={style.height}
				isInteractive={canBeSelected || isDoor}
				pointerdown={onBadgePointerDown}
			/>
			{!isDoor && (
				<React.Fragment>
					<StatusSkin
						badgeWidth={bodyWidth}
						badgeHeight={style.height}
						isConnected={isConnected}
						isThing={isThing}
						isInfected={isInfected}
						quarantine={quarantine}
						avatar={avatar}
					/>
					<BadgeShade badgeWidth={bodyWidth} badgeHeight={style.height}/>
					{/* Ник — на подложке у всех: под ним теперь лицо игрока (а у кого-то
					    ещё и карта статуса поверх), и по картинке белые буквы теряются.
					    Ровного кружка, по которому они читались сами по себе, больше нет.
					    Свой при этом жирный и золотой: за абсолютным столом себя надо
					    находить взглядом. */}
					<PlatedNickname
						text={nick}
						style={isYou ? youNicknameStyle : nicknameStyle}
						y={style.height * nicknameDrop}
					/>
					<Quarantine
						quarantine={quarantine}
						badgeWidth={style.width}
						badgeHeight={style.height}
						isInteractive={!canBeSelected}
					/>
					{/* Роль игрока — это сам бейдж: отдельных значков нечто/заражения нет.
					    Своя пометка сидит на макушке кружка и наполовину торчит за него:
					    внутри её не отличить от рисунка на бейдже (а у карантинного там
					    ещё и карта), да и разглядывать чужие пометки приходится по всему
					    столу разом — по верхнему краю они читаются одним взглядом. */}
					{(mark && mark !==EPlayerMark.none && !isRoleKnown) && (
						<Sprite
							texture={getMarkTexture(mark)}
							anchor={0.5}
							y={-style.height/2}
							width={style.width * 0.3}
							height={style.width * 0.3}
						/>
					)}
				</React.Fragment>
			)}
		</Container>
	)
};

export default PlayerBadge;
