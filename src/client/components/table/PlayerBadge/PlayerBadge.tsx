import React from 'react';
import {map, times} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import {useSpring} from 'react-spring/universal';
import type {OpaqueInterpolation} from 'react-spring/universal';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import EllipseTexture from 'client/components/pixiPrimitives/EllipseTexture';
import Plate from 'client/components/pixiPrimitives/Plate';
import {tableSquash} from 'client/helpers/roomHelpers';
import {sphereShadeTexture} from 'client/helpers/sphereShade';
import {resources} from 'client/resources/resources';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
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
 * Статус игрока виден по самому кружку: на него натянуто то, чем его сделали.
 * Раньше карантинный кружок просто гас до сорока процентов (и читался как
 * отключившийся), а роль показывали отдельно нарисованные круглые бейджи — те же
 * карты, но перерисованные заново и живущие своей жизнью.
 *
 * Картинка вписана ровно в эллипс (см. EllipseTexture), поэтому она лежит НА
 * игроке, а не прямоугольной наклейкой поверх стола вокруг него. Рисованы они
 * сразу под кружок (см. resources.thingAvatar и resources.infectedAvatars) и
 * берутся целиком — кадрировать нечего, картинки уже собраны как надо.
 */
const wholePicture = {x: 0, y: 0, width: 1, height: 1};
const statusSkins = {
	thing: {texture: getPixiTexture(resources.thingAvatar), focus: wholePicture},
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
	// Номер лица игрока (см. avatarTextureOf): по нему берётся и заражённое.
	avatar: string;
}

/**
 * Кем игрок закрыт. Роль важнее заражения: заражённое нечто всё равно нечто, и
 * знающему о роли важнее видеть именно её. Отключившегося не закрываем ничем:
 * то, что человека нет за столом, важнее всего остального, что можно о нём
 * сказать.
 *
 * Заражённое лицо — своё на каждого: без номера лица (до старта партии его ещё
 * нет) показывать нечего, и кружок остаётся чистым.
 */
const statusSkinOf = ({isConnected, isThing, isInfected, avatar}: IStatusArgs) => {
	if (!isConnected) return null;
	if (isThing) return statusSkins.thing;
	if (isInfected) return avatar === '' ? null : (infectedSkins[Number(avatar) % infectedSkins.length] ?? null);
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

// Цепи карантина — с прозрачным фоном, поэтому ложатся ПОВЕРХ кружка, кем бы он
// ни был закрыт: карантин не отменяет ни роли, ни заражения, а накладывается на
// них. Раньше он был таким же скином, как они, и просто их вытеснял — по кружку
// заражённого в карантине нельзя было сказать, что он заражён.
//
// Замков на картинке столько, сколько игроку осталось ходов в карантине: он и
// есть счётчик, отдельных точек под ним больше нет. Отсюда и порядок в списке —
// по индексу «сколько ходов осталось минус один».
const quarantineChainsTextures = [
	getPixiTexture(resources.quarantineChains1),
	getPixiTexture(resources.quarantineChains2),
	getPixiTexture(resources.quarantineChains3),
];
// Цепи нарисованы под пропорции кружка (см. badgeAspect), поэтому просто
// уменьшаем их до кружка, а не заливаем по эллипсу, как остальные картинки:
// заливка срезала бы им края с креплениями — то, чем цепи и держатся.
//
// Цепи крупнее самого кружка и подняты к его макушке: крепления прибиты по
// верхнему краю яйца, а не спрятаны внутрь, и крайние из них свешиваются за
// бока. Так карантин виден со всего стола — цепями заперт весь игрок целиком, а
// не нарисован значок у него на груди.
const quarantineChainsShare = 1.05;
// Подъём — в долях высоты кружка вверх от его середины.
const quarantineChainsLift = 0.1;

export const QuarantineSkin = ({quarantine, isConnected, badgeWidth, badgeHeight, isInteractive = false}: {
	quarantine: number;
	isConnected: boolean;
	badgeWidth: number;
	badgeHeight: number;
	isInteractive?: boolean;
}) => {
	if (!isConnected || quarantine <= 0) return null;
	// Ходов может прийти и больше, чем нарисовано замков (карантин продлевают
	// повторной картой): сверх нарисованного показываем самую «полную» картинку.
	const texture = quarantineChainsTextures[Math.min(quarantine, quarantineTurns) - 1];
	if (!texture) return null;
	return (
		<Sprite
			texture={texture}
			anchor={0.5}
			y={-badgeHeight * quarantineChainsLift}
			width={badgeWidth * quarantineChainsShare}
			height={badgeHeight * quarantineChainsShare}
			interactive={isInteractive}
			buttonMode={isInteractive}
			pointerdown={(event: PIXI.interaction.InteractionEvent) => isInteractive
				? toggleCardHintFor(EEventID.quarantine, event)
				: null}
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

/**
 * Статус игрока, который видно по яйцу: кем он закрыт и заперт ли он.
 *
 * Заражение и роль здесь ровно те, что дошли до этого зрителя: сервер шлёт их
 * только знающим (см. formatPlayer), поэтому и переворачивается яйцо только у
 * тех, кому есть что увидеть, — у заражённого и у нечто, а не у всего стола.
 */
interface IEggStatus {
	isConnected: boolean;
	isThing: boolean;
	isInfected: boolean;
	quarantine: number;
}

/**
 * Считается ли смена статуса переворотом. Роль и заражение — всегда: их меняют
 * один раз за партию, и это событие. Карантин — когда его вешают (или вешают
 * поверх, продлевая) и когда он спадает: цепи появились или их больше нет.
 *
 * А вот как карантин тикает (три хода, два, один), переворотом не считаем: там
 * не меняется статус, а идёт счётчик на тех же цепях (см. QuarantineSkin), и
 * крутить из-за него яйцо каждый ход — то же самое, что крутить его на каждой
 * секунде таймера.
 */
const isStatusTurn = (was: IEggStatus, now: IEggStatus): boolean =>
	was.isThing !== now.isThing
	|| was.isInfected !== now.isInfected
	|| now.quarantine > was.quarantine
	|| (was.quarantine > 0 && now.quarantine === 0);

/**
 * Сколько длится переворот. Столько же, сколько у карты паники (см. PanicCard):
 * на столе это одно и то же движение, и разъезжаться им незачем.
 */
const eggTurnMs = 560;

// Толщина яйца в долях его ширины, из скольких слоёв она сложена, насколько
// у́же полюс экватора и до чего темнеет нутро.
//
// Толщина небольшая: на ней держится только объём, а не сама картинка. Стоит
// развести слои пошире — и в повороте видно уже не выпуклое яйцо, а стопку
// отдельных картинок, разъезжающихся веером.
const eggThickness = 0.2;
const eggCoreCount = 5;
const eggTaper = 0.55;
const eggDarkness = 0.5;
// Полутолщина одного слоя — в долях полуширины яйца. Слой не бесконечно тонкий
// блин, а пластинка: встав ребром, он остаётся виден полоской, и соседние
// пластинки смыкаются в сплошной бок. Берём её равной шагу между слоями —
// тогда они перекрываются, и в боку нет щелей.
const eggSlice = eggThickness / (eggCoreCount - 1) / 0.5;
// Насколько яйцо вытягивается в середине поворота. Тот же приём, что у паники:
// без него поворот читается схлопыванием картинки, а не движением.
const eggBulge = 0.05;

/**
 * Слои, из которых сложено яйцо, — от затылка к лицу (в этом же порядке они и
 * рисуются: дальние сначала).
 *
 * Широкий и тёмный посередине, узкие и светлые по полюсам: посередине смотришь
 * в глубь яйца, а у полюсов — почти в его поверхность. Стопка симметрична, и
 * поэтому в середине переворота, когда яйцо стоит ребром, обе его стороны
 * выглядят одинаково — момент подмены одной другой не виден.
 */
const eggLayers = times(eggCoreCount, (index) => {
	// Глубина слоя в долях полутолщины: −1 — затылок, 0 — экватор, +1 — лицо.
	const level = -1 + (2 * index) / (eggCoreCount - 1);
	return {
		depth: (eggThickness / 2) * level,
		size: Math.sqrt(1 - level * level * eggTaper),
		dark: eggDarkness * Math.sqrt(Math.max(0, 1 - level * level)),
	};
});

interface IEggProps {
	status: IEggStatus;
	color: string;
	avatar: string;
	nick: string;
	isYou: boolean;
	badgeWidth: number;
	badgeHeight: number;
	isInteractive: boolean;
	pointerdown: (event: PIXI.interaction.InteractionEvent) => void;
	isQuarantineInteractive: boolean;
}

/**
 * Поверхность яйца — всё, что на игроке нарисовано: он сам, его статус,
 * светотень, цепи и подпись. Ровно то, что и стояло на столе до переворота, —
 * само по себе, без всякой стопки, это и есть обычный кружок игрока.
 */
const EggSurface = ({
	status: {isConnected, isThing, isInfected, quarantine},
	color,
	avatar,
	nick,
	isYou,
	badgeWidth,
	badgeHeight,
	isInteractive,
	pointerdown,
	isQuarantineInteractive,
}: IEggProps) => (
	<React.Fragment>
		{/* Кружок игрока — эллипс, а не круг: он стоит за столом, который мы
		    видим из-за его края, и вытянут по вертикали (см. badgeAspect). */}
		<BadgeBody
			isDoor={false}
			isConnected={isConnected}
			color={color}
			avatar={avatar}
			badgeWidth={badgeWidth}
			badgeHeight={badgeHeight}
			isInteractive={isInteractive}
			pointerdown={pointerdown}
		/>
		<StatusSkin
			badgeWidth={badgeWidth}
			badgeHeight={badgeHeight}
			isConnected={isConnected}
			isThing={isThing}
			isInfected={isInfected}
			avatar={avatar}
		/>
		<BadgeShade badgeWidth={badgeWidth} badgeHeight={badgeHeight}/>
		{/* Цепи — поверх всего кружка разом: и лица со статусом, и светотени.
		    Карантинного заперли снаружи, поверх того, кем он на этом столе
		    был, — поэтому цепи и ложатся на всё это сверху.

		    Нажатие по ним показывает саму карту «Карантин»: по цепям не
		    догадаться, что именно на игрока сыграли. Когда игрока выбирают
		    целью, цепи нажатий не берут — выбор важнее подсказки, и кружок
		    должен нажиматься весь одинаково. */}
		<QuarantineSkin
			quarantine={quarantine}
			isConnected={isConnected}
			badgeWidth={badgeWidth}
			badgeHeight={badgeHeight}
			isInteractive={isQuarantineInteractive}
		/>
		{/* Ник — на подложке у всех: под ним теперь лицо игрока (а у кого-то
		    ещё и картинка статуса с цепями поверх), и по этой пестроте белые
		    буквы теряются. Ровного кружка, по которому они читались сами по
		    себе, больше нет. Кладётся ник последним: как бы игрока ни закрыли,
		    прочесть, кто это, надо в любом случае. Свой при этом жирный и
		    золотой: за абсолютным столом себя надо находить взглядом. */}
		<PlatedNickname
			text={nick}
			style={isYou ? youNicknameStyle : nicknameStyle}
			y={badgeHeight * nicknameDrop}
		/>
	</React.Fragment>
);

/**
 * Слой в глубине яйца: то же лицо со статусом, но приглушённое темнотой и без
 * всего, что лежит на поверхности, — светотень, цепи и подпись нарисованы
 * снаружи, а не внутри. Нажатий такие слои не берут: игрок на столе один, и
 * нажимается у него поверхность.
 */
const EggCore = ({status: {isConnected, isThing, isInfected}, color, avatar, badgeWidth, badgeHeight, dark}: IEggProps & {dark: number}) => (
	<React.Fragment>
		<BadgeBody
			isDoor={false}
			isConnected={isConnected}
			color={color}
			avatar={avatar}
			badgeWidth={badgeWidth}
			badgeHeight={badgeHeight}
		/>
		<StatusSkin
			badgeWidth={badgeWidth}
			badgeHeight={badgeHeight}
			isConnected={isConnected}
			isThing={isThing}
			isInfected={isInfected}
			avatar={avatar}
		/>
		<Ellipse rx={badgeWidth / 2} ry={badgeHeight / 2} color={0x000000} alpha={dark}/>
	</React.Fragment>
);

/**
 * Одна сторона переворота — целое яйцо со своим статусом, повёрнутое на
 * пол-оборота вокруг вертикальной оси.
 *
 * Точка на глубине z, повёрнутая на угол, уезжает вбок на z·sin — на этом и
 * держится объём: слои разъезжаются тем сильнее, чем яйцо ближе к ребру, и
 * дальние выглядывают из-за поверхности сбоку. Сама поверхность при этом
 * сжимается по ширине как cos — она плоская, и на ребре её не видно вовсе;
 * толщину на ребре держат слои.
 *
 * Уходящая сторона поворачивается «от нас», приходящая — тем же поворотом, но
 * с изнанки, поэтому её слои разъезжаются в другую сторону: это одно и то же
 * яйцо, продолжающее крутиться.
 */
interface IEggSideProps extends IEggProps {
	turn: OpaqueInterpolation<number>;
	// Сторона, которая уходит: её видно, пока яйцо не встало ребром.
	isLeaving: boolean;
}

const EggSide = ({turn, isLeaving, ...egg}: IEggSideProps) => {
	const {badgeWidth} = egg;
	const side = isLeaving ? 1 : -1;
	const shiftOf = (depth: number) => turn.interpolate((value: number) =>
		side * depth * badgeWidth * Math.sin(Math.PI * value));
	return (
		<AnimatedPixi.Container
			visible={turn.interpolate((value: number) => (value < 0.5) === isLeaving)}
			scale={turn.interpolate((value: number): [number, number] =>
				[1, 1 + eggBulge * Math.sin(Math.PI * value)])}
		>
			{map(eggLayers, ({depth, size, dark}, index) => (
				<AnimatedPixi.Container
					key={index}
					x={shiftOf(depth)}
					scale={turn.interpolate((value: number): [number, number] => {
						const flat = Math.abs(Math.cos(Math.PI * value));
						const edge = Math.abs(Math.sin(Math.PI * value));
						return [Math.sqrt(size * size * flat * flat + eggSlice * eggSlice * edge * edge), size];
					})}
				>
					<EggCore {...egg} dark={dark}/>
				</AnimatedPixi.Container>
			))}
			<AnimatedPixi.Container
				x={shiftOf(eggThickness / 2)}
				scale={turn.interpolate((value: number): [number, number] =>
					[Math.abs(Math.cos(Math.PI * value)), 1])}
			>
				<EggSurface {...egg}/>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
};

// Сам переворот: монтируется на каждую смену статуса заново (см. Egg), поэтому
// крутится ровно один раз — от старой стороны к новой.
const EggTurn = ({was, ...egg}: IEggProps & {was: IEggStatus}) => {
	// Пол-оборота: 0 — к столу повёрнут старый статус, 1 — новый.
	const {turn} = useSpring<{turn: number}>({
		turn: 1,
		from: {turn: 0},
		config: {duration: eggTurnMs},
	});
	return (
		<React.Fragment>
			<EggSide {...egg} turn={turn} isLeaving={true} status={was}/>
			<EggSide {...egg} turn={turn} isLeaving={false}/>
		</React.Fragment>
	);
};

/**
 * Яйцо игрока. Пока статус тот же — это просто его поверхность, слой в слой как
 * было; сменился — она поворачивается на новую.
 *
 * Смену ловим прямо в рендере, а не эффектом: эффект отработает уже после того,
 * как новый статус нарисован, и переворот начнётся с кадра, на котором его
 * нечем начинать — новое лицо на столе уже стоит.
 */
const Egg = ({status, ...egg}: IEggProps) => {
	// Статус, с которым яйцо стоит на столе сейчас.
	const shown = React.useRef(status);
	// Идущий переворот: с какого статуса и какой он по счёту. Номером он
	// монтируется заново — каждая смена крутится своим оборотом с нуля.
	const turns = React.useRef(0);
	const turning = React.useRef<{seq: number, was: IEggStatus} | null>(null);
	const [, redraw] = React.useReducer((tick: number) => tick + 1, 0);

	if (isStatusTurn(shown.current, status)) {
		turns.current += 1;
		turning.current = {seq: turns.current, was: shown.current};
	}
	shown.current = status;

	const seq = turning.current ? turning.current.seq : 0;
	React.useEffect(() => {
		if (!seq) return;
		// Открутив своё, стопка слоёв со стола уходит: держать её ради яйца,
		// которое снова стоит к столу лицом, незачем.
		const timer = setTimeout(() => {
			turning.current = null;
			redraw();
		}, eggTurnMs);
		return () => clearTimeout(timer);
	}, [seq]);

	if (!turning.current) return <EggSurface {...egg} status={status}/>;
	return <EggTurn key={seq} {...egg} status={status} was={turning.current.was}/>;
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

			{/* Дверь — не игрок, а лежащая на месте соседей карта: ей и вертеться
			    нечем, статуса у неё нет. */}
			{isDoor ? (
				<BadgeBody
					isDoor={true}
					isConnected={isConnected}
					color={color}
					avatar={avatar}
					badgeWidth={bodyWidth}
					badgeHeight={style.height}
					isInteractive={true}
					pointerdown={onBadgePointerDown}
				/>
			) : (
				<React.Fragment>
					{/* Кружок игрока — эллипс, а не круг: он стоит за столом, который мы
					    видим из-за его края, и вытянут по вертикали (см. badgeAspect).
					    Сменившийся статус он показывает не подменой картинки, а
					    поворотом — см. Egg. */}
					<Egg
						status={{isConnected, isThing, isInfected, quarantine}}
						color={color}
						avatar={avatar}
						nick={nick}
						isYou={isYou}
						badgeWidth={bodyWidth}
						badgeHeight={style.height}
						isInteractive={canBeSelected}
						pointerdown={onBadgePointerDown}
						isQuarantineInteractive={!canBeSelected}
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
