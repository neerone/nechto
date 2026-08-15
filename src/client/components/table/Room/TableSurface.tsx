import React from 'react';
import {Container} from 'react-pixi-fiber';
import {map} from 'lodash';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import EllipseTexture from 'client/components/pixiPrimitives/EllipseTexture';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {tableSquash} from 'client/helpers/roomHelpers';

/**
 * Сам стол: круглая столешница, увиденная из-за её края, то есть эллипс, и торец
 * под ней.
 *
 * Стол на полу СТОИТ, а не лежит на нём. Отсюда всё остальное: столешница
 * поднята над серединой комнаты на lift, видна она под более пологим углом, чем
 * пол (её полуоси приходят уже посчитанными, см. tableTopSquash), а на полу под
 * ней лежит её тень — тот же круг, но в проекции пола и на своём месте. Без тени
 * стол висит в воздухе: подъём сам по себе читается не как высота, а как то, что
 * стол просто нарисован выше.
 *
 * Объём здесь держится на четырёх вещах, и все четыре обязательны: сплюснутая
 * проекция, видимый борт (столешница — доска, а не наклейка), тень на полу и то,
 * что сидящих на дальней половине стол загораживает — их рисуют ДО него (см.
 * Room).
 *
 * Никакой геометрии сама не считает: полуоси и подъём приходят из roomHelpers,
 * общие со всем остальным на столе.
 */

// Торец доски — самое тёмное пятно: свет на него не попадает.
const sideColor = 0x121110;
// Кант по краю столешницы: тонкая полоска, на которой ломается свет. Без него
// столешница сливается с бортом в одно плоское пятно.
const rimColor = 0x131103;
// Столешница — картинка: круглый клёпаный люк, увиденный сверху (см.
// resources.tableTop). Растягиваем её под эллипс, а не вписываем: это тот же
// круг, только в проекции стола, и рисунок обязан сжаться вместе с ним.
//
// На люке вырезаны стрелки очерёдности хода, и нарисованы они по часовой — так
// же, как идёт по экрану сама рассадка (см. roomPlayerAngle). Против часовой её
// разворачивает «Око за око», и тогда столешницу мы отражаем по горизонтали: у
// зеркального круга стрелки смотрят в другую сторону, а доски, клёпки и свет
// остаются теми же — картинка сама по себе почти симметрична, и подмены не
// видно.
const topTexture = getPixiTexture(resources.tableTop);
// Цвет под ней — на то время, пока картинка не догрузилась: пустой дырой посреди
// стола это выглядеть не должно.
const topColor = 0x2b2724;

// Кант — в долях полуоси, но не тоньше волоска и не толще этого.
const rimShare = 0.012;
const rimMin = 1;
const rimMax = 4;

// Тень стола на полу: два кольца, как и под игроками (см. PlayerShadow), — у
// одного сплошного эллипса слишком резкий край, и он читается второй столешницей.
// Доли — от полуосей круга, который столешница отбрасывает на пол.
const tableShadows = [
	{spread: 1.06, alpha: 0.22},
	{spread: 0.88, alpha: 0.3},
];
// Свет в комнате падает сверху слева (тот же, что лепит кружки игроков, см.
// sphereShadeTexture), поэтому тень уходит вправо и вниз — в долях подъёма
// столешницы: чем выше стол, тем дальше от него убегает тень.
const shadowShiftX = 0.5;
const shadowShiftY = 0.35;

interface ITableSurfaceProps {
	rx: number;
	ry: number;
	// Толщина борта: на столько торец выступает из-под столешницы.
	thickness: number;
	// Высота стола: на столько столешница поднята над полом (см. tableLift).
	lift: number;
	// Идёт ли очередь хода по часовой стрелке. От неё зависит только одно:
	// в какую сторону смотрят вырезанные на столешнице стрелки.
	isClockwise?: boolean;
}

const TableSurface = ({rx, ry, thickness, lift, isClockwise = true}: ITableSurfaceProps) => {
	if (rx <= 0 || ry <= 0) return null;
	const rim = Math.min(rimMax, Math.max(rimMin, ry * rimShare));
	return (
		<Container interactiveChildren={false}>
			{/* Тень на полу. Она в проекции ПОЛА, а не столешницы: лежит-то она на
			    полу, и потому шире её по вертикали — из-под ближнего края стола
			    видно ровно эту разницу. */}
			{map(tableShadows, ({spread, alpha}) => (
				<Ellipse
					key={spread}
					xCoord={lift * shadowShiftX}
					yCoord={lift * shadowShiftY}
					rx={rx * spread}
					ry={rx * spread * tableSquash}
					color={0x000000}
					alpha={alpha}
				/>
			))}
			<Container y={-lift}>
				{/* Торец: тот же эллипс, опущенный на толщину доски. Снизу из-под
				    столешницы видно ровно его. */}
				<Ellipse yCoord={thickness} rx={rx} ry={ry} color={sideColor}/>
				{/* Кант — столешница чуть больше того, что залито её цветом. */}
				<Ellipse rx={rx} ry={ry} color={rimColor}/>
				<Ellipse rx={rx - rim} ry={ry - rim} color={topColor}/>
				<EllipseTexture rx={rx - rim} ry={ry - rim} texture={topTexture} stretch={true} flipX={!isClockwise}/>
			</Container>
		</Container>
	);
};

export default TableSurface;
