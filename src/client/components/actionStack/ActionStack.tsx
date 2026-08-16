import React, {useLayoutEffect, useRef, useState} from 'react';
import {observer} from 'mobx-react';
import {map, sortBy} from 'lodash';
import cn from 'classnames';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import {resources} from 'client/resources/resources';
import HoverHint from 'client/components/hint/HoverHint';
import {getActorHighlight, getNickHighlights, renderLogText, type INickHighlight} from './logText';
import {useLeavingItems, type IKeyedItem} from './useLeavingItems';
import {
	ACTION_LABELS,
	getActionColors,
	getActionIcon,
	getActionType,
	getEntryCardId,
	getPendingColors,
	getPendingEntry,
	getPendingIcon,
	getStackCapacity,
	getStackEntries,
	getStackGeometry,
	PENDING_LABEL,
	type IStackEntry,
	type IStackGeometry,
} from './actionStackModel';

// Стек действий вместо ленты логов: каждое законченное действие на столе — своя
// карточка. По иконке (а у разыгранной карты — по самой картинке) видно, что
// случилось; подробности — в подсказке по наведению или тапу.
//
// Свежая карточка прилетает справа и встаёт в правый край стека, весь стек
// уезжает влево, а самая старая — та, что не влезла в круг стола, — улетает с
// левого края. Глубина стека равна числу живых игроков: столько шагов и было
// видно в логе.

// Держим в согласии с длительностями в styles.scss.
const LEAVE_MS = 380;

const cardImages = resources as unknown as {[key: string]: string | undefined};

interface IActionStackProps {
	controller: GameController;
}

// Стек уходит под канвас, пока висят уведомления: разглядывать историю, когда от
// тебя ждут решения, всё равно некогда, а окно решения должно быть сверху.
//
// Кроме меню выбора: под его затемнением стек лежать не должен — вопрос, на
// который это меню отвечает, написан на плашке требования в самом стеке (см.
// getPendingEntry), поэтому там он поднимается ВЫШЕ меню.
export const getZIndex = (controller: GameController) => {
	if (controller.currentAction && controller.currentAction.type === ENotificationAction.actionDecision) return 100;
	const firstNotification = controller.notifications.length ? controller.notifications[0] : undefined;
	if (firstNotification && firstNotification.type === ENotificationAction.gameEnd) return 100;
	const cardInPreview = controller.cardInPreview ? controller.hand[controller.cardInPreview] : undefined;
	if (cardInPreview || controller.notifications.length > 0) return 0;
	return 99;
};

const useElementWidth = (ref: React.RefObject<HTMLElement>) => {
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const node = ref.current;
		if (!node) return;
		const update = () => setWidth(node.clientWidth);
		update();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', update);
			return () => window.removeEventListener('resize', update);
		}
		const observer = new ResizeObserver(update);
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref]);
	return width;
};

// Знак, цвет и подпись карточки. У требования они свои: это не тип строки лога,
// а «от тебя ждут действия», и знак говорит какого именно.
const getTileFace = (item: IStackEntry) => item.pending
	? {colors: getPendingColors(), icon: getPendingIcon(item.pending), label: PENDING_LABEL}
	: {
		colors: getActionColors(getActionType(item.entry)),
		icon: getActionIcon(item.entry),
		label: ACTION_LABELS[getActionType(item.entry)],
	};

const ActionHint = ({item, highlights}: {item: IStackEntry, highlights: INickHighlight[]}) => {
	const {colors, icon, label} = getTileFace(item);
	return <span className={'actionHint'} style={colors}>
		<span className={'actionHintHead'}>
			<span className={'actionHintIcon'}>{icon}</span>
			<span className={'actionHintLabel'}>{label}</span>
		</span>
		<span className={'actionHintText'}>{renderLogText(item.entry.text, highlights)}</span>
		{map(item.details, (detail, index) => <span key={index} className={'actionHintDetail'}>
			{renderLogText(detail, highlights)}
		</span>)}
	</span>;
};

interface IActionTileProps {
	item: IStackEntry;
	// Отступ от левого края дорожки; у выбитой карточки — за её пределами.
	x: number;
	// 0 — самая свежая карточка стека, дальше вглубь.
	depth: number;
	isLeaving: boolean;
	geometry: IStackGeometry;
	highlights: INickHighlight[];
}

const ActionTile = ({item, x, depth, isLeaving, geometry, highlights}: IActionTileProps) => {
	const entry = item.entry;
	const isPending = !!item.pending;
	const {colors, icon} = getTileFace(item);
	// У требования картинки нет: знак «от тебя ждут хода» важнее той карты, что
	// текст мимоходом называет, — и он же несёт свечение.
	const cardId = isPending ? undefined : getEntryCardId(entry);
	const image = cardId ? cardImages[cardId] : undefined;
	const actor = getActorHighlight(entry.text, highlights);
	// Карточки лежат внахлёст, и у нижних видна только левая полоска — иконку
	// центруем по ней, иначе у половины стека она оказалась бы под соседкой.
	// Свежую не перекрывает никто, поэтому её знак стоит ровно посередине.
	const isTop = depth === 0 && !isLeaving;
	// Зелёная подсветка «вот это сейчас» достаётся требованию, когда оно есть:
	// две светящиеся карточки подряд спорили бы друг с другом.
	const isLatest = isTop && !isPending;
	const sliver = isTop ? geometry.cardWidth : Math.min(geometry.step, geometry.cardWidth);
	return <div
		className={cn('actionSlot', {isLeaving, isLatest, isPending})}
		style={{
			...colors,
			transform: `translateX(${x}px)`,
			width: geometry.cardWidth,
			height: geometry.cardHeight,
			// Свежая — сверху: её видно целиком, остальные уходят под неё.
			zIndex: isLeaving ? 0 : 100 - depth,
			['--action-sliver' as string]: `${sliver}px`,
			['--action-icon-size' as string]: `${Math.round(Math.min(sliver * 0.62, 22))}px`,
		}}
		data-action-type={isPending ? 'pending' : getActionType(entry)}
		data-action-card={cardId || ''}
	>
		<HoverHint
			className={'actionAnchor'}
			hintClassName={'actionHintPopup'}
			content={<ActionHint item={item} highlights={highlights}/>}
		>
			<span className={'actionTile'}>
				{/* Разыгранная карта показывается собой — знак типа поверх неё уже
				    ничего не добавляет, только загораживает. */}
				{image
					? <img className={'actionArt'} src={image} alt={''}/>
					: <span className={'actionIcon'}>{icon}</span>}
				{/* Полоска цвета того, кто действовал: в стеке видно «чей» шаг ещё
				    до подсказки — там ник покрашен тем же цветом. */}
				{actor ? <span className={'actionActor'} style={{background: actor.color}}/> : null}
			</span>
		</HoverHint>
	</div>;
};

const ActionStack = observer(({controller}: IActionStackProps) => {
	const areaRef = useRef<HTMLDivElement>(null);
	const available = useElementWidth(areaRef);
	const capacity = getStackCapacity(controller);
	const gameLog = controller.gameLog;

	// Требование к игроку стоит последним, за всей историей, и занимает в стеке
	// свой слот: остальные карточки от него сдвигаются влево ровно так же, как
	// от любого нового шага.
	const pending = getPendingEntry(controller);
	const slots = capacity + (pending ? 1 : 0);

	const entries = getStackEntries(gameLog);
	const visible: IKeyedItem<IStackEntry>[] = map(
		entries.slice(Math.max(entries.length - capacity, 0)),
		(item) => ({id: item.id, data: item}),
	);
	const leaving = useLeavingItems(visible, LEAVE_MS);

	const geometry = getStackGeometry(available, slots);
	const highlights = getNickHighlights(controller);
	// Живые и улетающие — одним списком и в одном порядке: React должен узнавать
	// карточку по ключу, иначе выбитая перемонтируется и «прилетит» заново.
	const tiles = sortBy([
		...map(visible, (item, index) => ({
			item,
			depth: visible.length - 1 - index + (pending ? 1 : 0),
			isLeaving: false,
		})),
		...map(leaving, (item) => ({item, depth: slots, isLeaving: true})),
	], ({item}) => item.id);
	// Не через useLeavingItems: требование пропадает выполненным, а не вытесненным
	// из стека, и уезжать за левый край через всю историю ему незачем.
	if (pending) tiles.push({item: {id: pending.id, data: pending}, depth: 0, isLeaving: false});

	return <div className={'actionStackWrapper'} style={{zIndex: getZIndex(controller)}}>
		<div className={'actionStackArea'} ref={areaRef}>
			{available > 0 && tiles.length
				? <div
					className={'actionStackTrack'}
					style={{width: geometry.trackWidth, height: geometry.cardHeight}}
				>
					{map(tiles, ({item, depth, isLeaving}) => <ActionTile
						// Плашку требования узнаём по типу действия, а не по номеру
						// строки: на каждое новое требование она перемонтируется и
						// заново прилетает в стек справа, как обычная карточка.
						key={item.data.pending ? `pending-${item.data.pending}` : item.id}
						item={item.data}
						// Слева направо — от старых к свежим, свежая всегда у правого
						// края; выбитая продолжает тот же ряд за левым краем.
						x={(slots - 1 - depth) * geometry.step}
						depth={depth}
						isLeaving={isLeaving}
						geometry={geometry}
						highlights={highlights}
					/>)}
				</div>
				: null}
		</div>
	</div>;
});

export default ActionStack;
