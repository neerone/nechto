import React from 'react';
import { observer } from "mobx-react-lite"
import {cardAspectRatio, fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';
import * as PIXI from 'pixi.js';
import { Container } from 'react-pixi-fiber';
import {interpolate} from 'react-spring/universal';
import type {AnimatedValue, OpaqueInterpolation} from 'react-spring/universal';
import {degToRag} from 'client/helpers/roomHelpers';
import {AnimatedPixi, getPixiTexture} from '../pixiInjected';

// The animated style object produced by react-spring's useTransition in HandComponent.
// Each key is an OpaqueInterpolation<number> which masquerades as a number and exposes
// `.interpolate`.
interface ICardStyleProps {
	x: number;
	y: number;
	angle: number;
	width: number;
}
type AnimatedCardStyle = AnimatedValue<ICardStyleProps>;
// HandComponent passes an animated (interpolated) style; Deck passes a static numeric
// style. Card supports both: each width access checks for `.interpolate` at runtime.
type CardStyle = AnimatedCardStyle | ICardStyleProps;

interface ICardProps {
	id: string;
	// Событие нажатия нужно тем, кто по клику открывает подсказку: она
	// прижимается к тому объекту на канвасе, по которому нажали (см. canvasHint).
	onCardClick?: ((event: PIXI.interaction.InteractionEvent) => void) | null;
	// Наведение курсора: рукой используется, чтобы «вытащить» карту из веера.
	// Колода (Deck) обработчики не передаёт.
	onCardOver?: (() => void) | null;
	onCardOut?: (() => void) | null;
	// На сколько пикселей карта уезжает вверх при наведении: на столько же вниз
	// вытягивается невидимая ловушка наведения (см. ниже).
	hoverPad?: number;
	canBeUsed?: boolean;
	// Во сколько раз карта сжата по вертикали. Лежащая на столе карта видна в той
	// же проекции, что и сам стол (см. tableSquash), — иначе она стоит на нём
	// торчком, как декорация. Карты в руке смотрящий держит перед собой, их
	// проекция не касается: у них squash = 1.
	squash?: number;
	style: CardStyle;
	// The `menu` renderer is only supplied by HandComponent, which always pairs it with
	// an animated style; the static-style caller (Deck) never passes a menu.
	menu?: (style: AnimatedCardStyle) => React.ReactNode;
	// Отметка поверх карты (галочка выбранной карты в окне множественного выбора):
	// рисуется всегда, когда передана, и кликов не перехватывает — по самой карте
	// её же и снимают.
	badge?: (style: AnimatedCardStyle) => React.ReactNode;
}

// react-pixi-fiber присваивает обработчик прямо в свойство DisplayObject и снять
// его не умеет: prop со значением undefined он только сопровождает варнингом
// «ignoring prop», оставляя на спрайте прежний колбэк (у колоды это значило, что
// клик по ней вызывал cardPick и после окончания взятия). Поэтому обработчики
// передаём всегда определёнными, а «выключенное» состояние — это пустой вызов.
const noop = () => {};

// A style is "animated" when its values expose react-spring's `.interpolate`.
const isAnimatedStyle = (style: CardStyle): style is AnimatedCardStyle =>
	typeof (style.width as OpaqueInterpolation<number>)?.interpolate === 'function';

// resources is an object literal whose card-image entries are all `string` (the only
// non-string entries — `playerBadges`, `avatars` and `infectedAvatars` — are never
// looked up here).
// We view it through a string index signature so a card image can be looked up by an
// arbitrary `id`, yielding `string | undefined` under noUncheckedIndexedAccess.
const {playerBadges: _playerBadges, avatars: _avatars, infectedAvatars: _infectedAvatars, ...cardImages} = resources;
const cardResources: Record<string, string | undefined> = cardImages;

const Card = observer(({id, menu, badge, onCardClick, onCardOver, onCardOut, hoverPad = 0, canBeUsed, squash = 1, style}: ICardProps) => {
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	const cardTexture = getPixiTexture(cardResources[id]);
	const glowTexture = getPixiTexture(cardResources['glowEffect']);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}
	const cardGlowWidth = isAnimatedStyle(style) ? style.width.interpolate(w => w * 1.15) : style.width * 1.15
	const cardGlowHeight = isAnimatedStyle(style) ? style.width.interpolate(w => w * cardAspectRatio * 1.1 * squash) : style.width * cardAspectRatio * 1.1 * squash
	const cardWidth = isAnimatedStyle(style) ? style.width.interpolate(w => w) : style.width
	const cardHeight = isAnimatedStyle(style) ? style.width.interpolate(w => w * cardAspectRatio * squash) : style.width * cardAspectRatio * squash

	// Ловушка наведения: невидимый спрайт по размеру карты, вытянутый вниз (вдоль
	// собственной оси карты, поэтому наклонённым картам веера тоже подходит).
	// Карта под курсором поднимается над рукой, и без ловушки её нижняя кромка
	// уезжала бы из-под курсора: pointerout → карта опускается → снова pointerover,
	// и hover мигал бы. Ловушка лежит поверх карты и берёт на себя наведение и
	// клик; меню рисуется после неё и перехватывает клики первым.
	const padExtend = hoverPad * 1.4;
	const hoverTrap = padExtend > 0 && isAnimatedStyle(style) ? (
		<AnimatedPixi.Sprite
			texture={PIXI.Texture.WHITE}
			alpha={0}
			buttonMode={true}
			interactive={true}
			anchor={0.5}
			angle={style.angle}
			x={interpolate([style.x, style.angle], (x, a) => x - Math.sin(degToRag(a)) * padExtend / 2)}
			y={interpolate([style.y, style.angle], (y, a) => y + Math.cos(degToRag(a)) * padExtend / 2)}
			width={cardWidth}
			height={style.width.interpolate(w => w * cardAspectRatio + padExtend)}
			pointerdown={onCardClick ?? noop}
			pointerover={onCardOver ?? noop}
			pointerout={onCardOut ?? noop}
		/>
	) : null;

	return (
		<Container  >
			{/* Подсветка играбельной карты не снимается с дерева, а прячется: карта
			    перестаёт быть играбельной ровно в тот момент, когда ею ходят, то
			    есть посреди движения веера. Снятый в этот момент спрайт react-spring
			    всё равно трогает своим уже назначенным кадром — и React ругается на
			    обновление размонтированного компонента. */}
			<AnimatedPixi.Sprite
				texture={glowTexture}
				visible={!!canBeUsed}
				anchor={0.5}
				{...style}
				width={cardGlowWidth}
				height={cardGlowHeight}
			/>
			<AnimatedPixi.Sprite
				buttonMode={true}
				interactive={true}
				texture={cardTexture}
				pointerdown={onCardClick ?? noop}
				pointerover={onCardOver ?? noop}
				pointerout={onCardOut ?? noop}
				anchor={0.5}
				{...style}
				width={cardWidth}
				height={cardHeight}
			/>
			{hoverTrap}
			{badge && isAnimatedStyle(style) && (
				<React.Fragment>
					{badge(style)}
				</React.Fragment>
			)}
			{menu && isAnimatedStyle(style) && (
				<React.Fragment>
					{menu(style)}
				</React.Fragment>
			)}
		</Container>
	)
});

export default Card;
