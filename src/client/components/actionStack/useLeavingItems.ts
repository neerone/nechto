import {useEffect, useRef, useState} from 'react';
import {filter, includes, map} from 'lodash';

export interface IKeyedItem<T> {
	id: number;
	data: T;
}

// Выбитые из стека карточки нужно ещё показать: они улетают влево, а не исчезают
// на месте. Держим их отдельным списком ровно на время анимации и отдаём наружу,
// чтобы стек отрисовал их одним списком с живыми (React должен узнать тот же
// элемент, иначе он пересоздаст узел и карточка «влетит» ещё раз).
export const useLeavingItems = <T>(items: IKeyedItem<T>[], leaveMs: number): IKeyedItem<T>[] => {
	const [leaving, setLeaving] = useState<IKeyedItem<T>[]>([]);
	const previous = useRef<IKeyedItem<T>[]>(items);
	const timers = useRef<number[]>([]);
	// Пересчитываем только когда меняется состав, а не порядок или содержимое.
	const membership = map(items, 'id').join(',');

	useEffect(() => {
		const aliveIds = map(items, 'id');
		const gone = filter(previous.current, (item) => !includes(aliveIds, item.id));
		previous.current = items;
		if (!gone.length) return;
		const goneIds = map(gone, 'id');
		setLeaving((current) => [...filter(current, (item) => !includes(goneIds, item.id)), ...gone]);
		const timer = window.setTimeout(
			() => setLeaving((current) => filter(current, (item) => !includes(goneIds, item.id))),
			leaveMs,
		);
		timers.current.push(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [membership, leaveMs]);

	useEffect(() => () => {
		timers.current.forEach(window.clearTimeout);
		timers.current = [];
	}, []);

	return leaving;
};
