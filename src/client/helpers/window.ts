import {clamp} from 'lodash';
import {cardAspectRatio, cardWidthPercent} from 'shared/constant/cards';
import {viewport} from 'client/helpers/viewport';

// Размер сцены, а не окна: канвас живёт в своём контейнере и следит за ним
// (см. viewport). Значения observable — компоненты стола пересчитывают
// координаты сами, как только окно меняется.
export const getWindowHeight = () => viewport.height;

export const getWindowWidth = () => viewport.width;

// Сверху стол перекрыт стеком действий (см. ActionStack — полоска карточек с
// требованием текущего хода в правом конце), снизу — рукой. Свободное поле
// между ними и есть та область, в которую надо вписывать круг игроков.
const topOverlayHeight = () => getWindowHeight() * 0.09 + 36;

// Веер приподнимает крайние карты над номинальной полосой руки, поэтому места
// под неё резервируем с запасом — иначе нижний игрок оказывается под картами.
const handReservedHeight = () => playerHandHeight() * 1.15;

export const tableField = () => {
	const top = topOverlayHeight();
	const bottom = getWindowHeight() - handReservedHeight();
	return {top, bottom, width: getWindowWidth(), height: Math.max(0, bottom - top)};
};

// Насколько стол с игроками поднят над серединой свободного поля, в долях его
// высоты. Ровно посередине они сидят низковато: снизу пусто, а сверху стол
// подпирает лог. Подъём отдаёт этот запас вверх.
//
// Поднимается только слой стола: сама арена (см. RoomBackdrop) остаётся на месте
// — её анкер отдельный. Двигать её вместе со столом пробовали: комната уезжает
// вверх целиком, и подъёма не видно вовсе.
const roomLiftShare = 0.06;

// На столько же ужимается и то поле, в которое стол вписывается: подняв середину,
// мы приблизили её к логу, и сверху места стало меньше ровно на подъём. Считать
// размеры по прежней половине поля нельзя — дальние кружки уехали бы под лог.
export const roomLift = () => tableField().height * roomLiftShare;

// Центр стола — середина свободного поля, а не окна: раньше круг игроков был
// прибит к центру экрана, из-за чего сверху его резал лог, а снизу подпирали
// карты руки.
export const tableCenterX = () => getWindowWidth() / 2;
export const tableCenterY = () => backdropAnchorY() - roomLift();

// Куда привязана арена: середина свободного поля, без подъёма стола. Комната
// стоит там, где стоит, — стол лишь поднят внутри неё.
export const backdropAnchorY = () => {
	const {top, bottom} = tableField();
	return (top + bottom) / 2;
};


// Карты в окнах выбора (упорство, «посмотри вокруг» и т.п.) лежат ровным рядом.
// Ширину считаем так, чтобы весь ряд с зазорами влез по ширине экрана, а
// увеличенная выбранная карта — по высоте. Иначе карты наезжают друг на друга и
// выбранную (особенно центральную) не отличить от соседних.
export const notificationCardGap = 1.12;
export const selectedNotificationCardScale = 1.3;

export const autoWidthCard = (cardsCount: number) => {
	const byWidth = (getWindowWidth() * 0.94) / Math.max(cardsCount, 1) / notificationCardGap;
	const byHeight = (getWindowHeight() * 0.5) / (cardAspectRatio * selectedNotificationCardScale);
	return clamp(Math.min(byWidth, byHeight), 80, 260);
}
// Сработавшая паника лежит в центре стола: заметно крупнее колоды, но не
// настолько, чтобы закрыть собой стол — по нему в это время продолжают играть
// (цепная реакция), а прочитать карту получше можно нажатием на неё.
export const panicCardWidth = () => {
	const field = tableField();
	return clamp(Math.min(getWindowWidth() * 0.22, (field.height * 0.42) / cardAspectRatio), 80, 190);
};

export const playerCardWidthPix = () => playerHandHeight() / cardAspectRatio;
export const playerHandHeight = () => clamp((getWindowWidth() / (100/cardWidthPercent)) * cardAspectRatio, 50, getWindowHeight() / 5);
