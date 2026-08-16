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
	getStackCapacity,
	getStackEntries,
	getStackGeometry,
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
export const getZIndex = (controller: GameController) => {
	if (controller.currentAction && controller.currentAction.type === ENotificationAction.actionDecision) return 99;
	const firstNotification = controller.notifications.length ? controller.notifications[0] : undefined;
	if (firstNotification && firstNotification.type === ENotificationAction.gameEnd) return 99;
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

const ActionHint = ({item, highlights}: {item: IStackEntry, highlights: INickHighlight[]}) => {
	const type = getActionType(item.entry);
	return <span className={'actionHint'} style={getActionColors(type)}>
		<span className={'actionHintHead'}>
			<span className={'actionHintIcon'}>{getActionIcon(item.entry)}</span>
			<span className={'actionHintLabel'}>{ACTION_LABELS[type]}</span>
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
	const type = getActionType(entry);
	const cardId = getEntryCardId(entry);
	const image = cardId ? cardImages[cardId] : undefined;
	const actor = getActorHighlight(entry.text, highlights);
	// Карточки лежат внахлёст, и у нижних видна только левая полоска — иконку
	// центруем по ней, иначе у половины стека она оказалась бы под соседкой.
	// Свежую не перекрывает никто, поэтому её знак стоит ровно посередине.
	const isLatest = depth === 0 && !isLeaving;
	const sliver = isLatest ? geometry.cardWidth : Math.min(geometry.step, geometry.cardWidth);
	return <div
		className={cn('actionSlot', {isLeaving, isLatest})}
		style={{
			...getActionColors(type),
			transform: `translateX(${x}px)`,
			width: geometry.cardWidth,
			height: geometry.cardHeight,
			// Свежая — сверху: её видно целиком, остальные уходят под неё.
			zIndex: isLeaving ? 0 : 100 - depth,
			['--action-sliver' as string]: `${sliver}px`,
			['--action-icon-size' as string]: `${Math.round(Math.min(sliver * 0.62, 22))}px`,
		}}
		data-action-type={type}
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
					: <span className={'actionIcon'}>{getActionIcon(entry)}</span>}
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

	const entries = getStackEntries(gameLog);
	const visible: IKeyedItem<IStackEntry>[] = map(
		entries.slice(Math.max(entries.length - capacity, 0)),
		(item) => ({id: item.id, data: item}),
	);
	const leaving = useLeavingItems(visible, LEAVE_MS);

	const geometry = getStackGeometry(available, capacity);
	const highlights = getNickHighlights(controller);
	// Живые и улетающие — одним списком и в одном порядке: React должен узнавать
	// карточку по ключу, иначе выбитая перемонтируется и «прилетит» заново.
	const tiles = sortBy([
		...map(visible, (item, index) => ({item, depth: visible.length - 1 - index, isLeaving: false})),
		...map(leaving, (item) => ({item, depth: capacity, isLeaving: true})),
	], ({item}) => item.id);

	return <div className={'actionStackWrapper'} style={{zIndex: getZIndex(controller)}}>
		<div className={'actionStackArea'} ref={areaRef}>
			{available > 0 && tiles.length
				? <div
					className={'actionStackTrack'}
					style={{width: geometry.trackWidth, height: geometry.cardHeight}}
				>
					{map(tiles, ({item, depth, isLeaving}) => <ActionTile
						key={item.id}
						item={item.data}
						// Слева направо — от старых к свежим, свежая всегда у правого
						// края; выбитая продолжает тот же ряд за левым краем.
						x={(capacity - 1 - depth) * geometry.step}
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
