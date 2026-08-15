import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {interpolate, useSpring} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {cardAspectRatio} from 'shared/constant/cards';
import {tableCardPoint, tableCardTaper, tableTopSquash} from 'client/helpers/roomHelpers';
import {panicCardWidth, tableCenterX, tableCenterY} from 'client/helpers/window';
import {toggleCardHintFor} from 'client/components/hint/canvasHint';
import type {IFormatPanicCard} from 'shared/interfaces/common';

interface IPanicCardProps {
	controller: GameController
}

// resources — объектный литерал, у которого все карточные поля строковые
// (нестроковые там только playerBadges, avatars и infectedAvatars, за которыми
// мы не ходим). Смотрим на него через строковый индекс, чтобы взять картинку по
// id карты.
const {playerBadges: _playerBadges, avatars: _avatars, infectedAvatars: _infectedAvatars, ...cardImages} = resources;
const cardResources: Record<string, string | undefined> = cardImages;

// Карта выходит на стол рубашкой вверх и тут же переворачивается лицом.
const flipDelayMs = 220;
const flipDurationMs = 480;
// А перевернувшись — встаёт: лежащая трапеция распрямляется в стоячую карту,
// разом теряя и сужение к дальнему краю, и сжатие по высоте (см. tableTopSquash и
// tableCardTaper), и заодно подрастает. Пауза перед подъёмом — чтобы движения
// не слились в одно: сначала все видят, ЧТО выпало, и только потом карта
// поднимается.
const risePauseMs = 140;
const riseDurationMs = 520;
// Во сколько раз вставшая карта крупнее лежавшей: её читают всем столом.
const riseScale = 1.18;

// Отработав, паника растворяется: приподнимается над столом и одновременно
// тает. Раньше она просто пропадала — событие кончалось, и карта исчезала
// посреди стола без всякого движения.
const tossMs = 460;
// На сколько она успевает подняться, в долях собственной высоты.
const tossLiftShare = 0.5;

// Сама карта: монтируется на каждую новую панику, поэтому переворот играется
// ровно один раз — на появлении.
interface IPanicCardViewProps {
	panicCard: IFormatPanicCard;
	place: {x: number, y: number};
	// Событие карты кончилось: пора растворяться.
	isLeaving: boolean;
	// Нажатие по карте: показать её крупно и смахнуть со стола.
	onDismiss: (event: PIXI.interaction.InteractionEvent) => void;
}

const PanicCardView = observer(({panicCard, place, isLeaving, onDismiss}: IPanicCardViewProps) => {
	// Полуоборот вокруг вертикальной оси: 0 — рубашка, 1 — лицо.
	const {flip} = useSpring<{flip: number}>({
		flip: 1,
		from: {flip: 0},
		delay: flipDelayMs,
		config: {duration: flipDurationMs},
	});

	// Подъём: 0 — карта лежит на столе в его проекции, 1 — стоит на нём прямо,
	// лицом к смотрящему.
	const {rise} = useSpring<{rise: number}>({
		rise: 1,
		from: {rise: 0},
		delay: flipDelayMs + flipDurationMs + risePauseMs,
		config: {duration: riseDurationMs},
	});

	const laidWidth = panicCardWidth();
	// Габариты по ходу подъёма: карта растёт, сжатие по высоте сходит на нет, и
	// сужение к дальнему краю распрямляется.
	const widthAt = (r: number) => laidWidth * (1 + (riseScale - 1) * r);
	const heightAt = (r: number) => widthAt(r) * cardAspectRatio * (tableTopSquash + (1 - tableTopSquash) * r);
	const taperAt = (r: number) => tableCardTaper + (1 - tableCardTaper) * r;

	// Рубашка сжимается к нулю, лицо из нуля разворачивается. Высота на середине
	// переворота чуть больше — так поворот читается объёмным, а не схлопыванием
	// картинки.
	const backWidth = interpolate([flip, rise], (v: number, r: number) =>
		Math.max(0, Math.cos(Math.PI * v)) * widthAt(r));
	const faceWidth = interpolate([flip, rise], (v: number, r: number) =>
		Math.max(0, -Math.cos(Math.PI * v)) * widthAt(r));
	const cardHeight = interpolate([flip, rise], (v: number, r: number) =>
		heightAt(r) * (1 + 0.12 * Math.sin(Math.PI * v)));
	const cardTaper = rise.interpolate((r: number) => taperAt(r));

	// Растворение: пока событие идёт — ноль, кончилось — единица.
	const {toss} = useSpring<{toss: number}>({
		toss: isLeaving ? 1 : 0,
		config: {duration: tossMs},
	});

	// Встаёт карта с того места, где лежала: нижняя кромка остаётся на столе, а
	// растёт она вверх. Иначе она не поднимается, а всплывает над столом. Уходя,
	// она приподнимается над ним ещё немного — и на этом тает.
	const cardY = interpolate([rise, toss], (r: number, t: number) =>
		tableCenterY() + place.y + (heightAt(0) - heightAt(r)) / 2 - heightAt(1) * tossLiftShare * t);

	const cardProps = {
		height: cardHeight,
		taper: cardTaper,
		// Растворяющуюся карту не нажимают: её на столе уже нет.
		interactive: !isLeaving,
		buttonMode: !isLeaving,
		// Нажатие показывает карту крупно и убирает её со стола (см. onDismiss).
		pointerdown: onDismiss,
	};

	return (
		// Место и прозрачность — на контейнере: поднимается и тает карта целиком, а
		// не двумя своими сторонами по отдельности.
		<AnimatedPixi.Container
			x={tableCenterX() + place.x}
			y={cardY}
			// Тает она со сглаженными концами: у линейной прозрачности видно, как
			// она включается и обрывается.
			alpha={toss.interpolate((t: number) => 1 - t * t * (3 - 2 * t))}
		>
			{/* Выпадает паника той же трапецией, что и колода под ней (иначе рядом с
			    ней она бы разъехалась краями), а дальше распрямляется — и уже стоит
			    на столе обычной картой, которую видно целиком. */}
			<AnimatedPixi.PerspectiveTexture
				{...cardProps}
				texture={getPixiTexture(cardResources['panicBack'])}
				width={backWidth}
			/>
			<AnimatedPixi.PerspectiveTexture
				{...cardProps}
				texture={getPixiTexture(cardResources[panicCard.id])}
				width={faceWidth}
			/>
		</AnimatedPixi.Container>
	)
});

// Сработавшая паника лежит крупно в центре стола всё время своего события (и не
// меньше выдержки на чтение — см. gameController.syncPanicCard). Отдельного окна
// с паникой больше нет: пока карта здесь, колода закрыта.
// Чем карта отличается от предыдущей: у сыгранной паники есть свой uniqueId, у
// мгновенной (её никто не держал в руке) — только id.
const panicKey = (card: IFormatPanicCard): string => card.uniqueId || card.id;

const PanicCard = observer(({controller}: IPanicCardProps) => {
	const {panicCard} = controller;
	// Отработавшую карту держим на столе ещё на время растворения: событие
	// кончилось, но карте надо успеть с него уйти.
	//
	// Держим её прямо здесь, в рендере, а не в состоянии по эффекту: на первом же
	// рендере без паники компонент снялся бы с дерева и вернулся бы уже новым —
	// с пружинами, начатыми заново, и с растворением, которое к первому же своему
	// кадру уже кончилось. Карта просто исчезала бы, только другим путём.
	const shown = React.useRef<IFormatPanicCard | null>(null);
	// Какую карту смотрящий уже смахнул со стола. Стоячая паника занимает
	// середину стола во весь рост и закрывает собой дальние места — а выбрать там
	// могут попросить именно того, кто за ней. Поэтому её можно снять: нажатие
	// показывает карту крупно, со всем её текстом, и тем же движением сгоняет её
	// со стола.
	//
	// Смахивание — дело зрителя, а не партии: у остальных карта остаётся на месте,
	// и колода всё так же закрыта, пока паника не отработает (см. Deck).
	const dismissed = React.useRef<string | null>(null);
	const [, redraw] = React.useReducer((tick: number) => tick + 1, 0);
	const tossTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const isDismissed = !!panicCard && dismissed.current === panicKey(panicCard);
	if (panicCard && !isDismissed) shown.current = panicCard;
	const card = shown.current;

	React.useEffect(() => {
		// Новая паника выходит на стол сама и старую с него сгоняет.
		if (panicCard && !isDismissed) {
			if (tossTimer.current) clearTimeout(tossTimer.current);
			tossTimer.current = null;
			return;
		}
		if (!shown.current || tossTimer.current) return;
		tossTimer.current = setTimeout(() => {
			tossTimer.current = null;
			shown.current = null;
			redraw();
		}, tossMs);
	}, [panicCard, isDismissed]);
	React.useEffect(() => () => {
		if (tossTimer.current) clearTimeout(tossTimer.current);
	}, []);

	if (!card) return null;
	// Нажали по карте: показываем её крупно тем же окошком, что и дверь с
	// карантином на столе, — и запускаем ей уход.
	const dismiss = (event: PIXI.interaction.InteractionEvent) => {
		toggleCardHintFor(card.id, event);
		dismissed.current = panicKey(card);
		redraw();
	};
	// key — чтобы каждая новая паника монтировалась заново и переворачивалась.
	return (
		<PanicCardView
			key={panicKey(card)}
			panicCard={card}
			place={tableCardPoint(controller.playersList.length)}
			isLeaving={!panicCard || isDismissed}
			onDismiss={dismiss}
		/>
	);
});

export default PanicCard;
