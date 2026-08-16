import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import type INotificationAction from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import HandComponent from 'client/components/table/Hand/HandComponent';
import {
	autoWidthCard,
	getWindowHeight,
	getWindowWidth,
	playerCardWidthPix,
	selectedNotificationCardScale,
	tableCenterY,
} from 'client/helpers/window';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import Rectangle from 'client/components/pixiPrimitives/Rectangle';
import {cardAspectRatio} from 'shared/constant/cards';

interface INotifierProps {
	controller:  GameController;
}

// Текст рисуется в текстуру размером ровно по замеру строки, поэтому всё, что
// вылезает за замер, обрезается. Два таких вылета: textBaseline: 'bottom' (pixi
// ставит строку по ascent, считая базовую линию alphabetic, и при 'bottom' буквы
// уезжают вверх на descent — срезало верхушки) и размытие тени (в замер входит
// только dropShadowDistance, не blur — на это и нужен padding).
const getFontStyle = (fontSize: number, maxWidth: number) => ({
    align: "center",
    dropShadow: true,
    dropShadowAngle: 90,
    dropShadowBlur: 4,
    dropShadowColor: "#63fe6a",
    dropShadowDistance: 1,
    fill: "white",
    letterSpacing: 1,
    lineHeight: 26,
    lineJoin: "round",
    padding: 6,
    stroke: "#91ff88",
    wordWrap: true,
    fontSize: fontSize,
    wordWrapWidth: maxWidth
})

const Notification = observer(({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	const okayTexture = getPixiTexture(resources.okay)
	const {cardInNotificationPreview} = controller;

	const notificationFontSize = 22;
	// Центр ряда карт и его высота С УЧЁТОМ увеличения выбранной карты. Подпись и
	// кнопку вешаем ПОД ряд: сверху висит бейдж действия (DOM) с тем же текстом, и
	// раньше надписи налезали друг на друга.
	const cardsRowCenterY = tableCenterY();
	const rowHeight = (cardsCount: number) =>
		autoWidthCard(cardsCount) * cardAspectRatio * selectedNotificationCardScale;
	const textY = (rowCardHeight: number) => cardsRowCenterY + rowCardHeight / 2 + notificationFontSize * 1.2;
	let cardHeight = 0;
	switch (notification.type) {
		case ENotificationAction.okayCard:
			cardHeight = rowHeight(Object.keys(notification.cards).length);
			notificationContent = (
				<React.Fragment>
					<Sprite
						texture={okayTexture}
						interactive={true}
						buttonMode={true}
						pointerdown={() => controller.activatePlayerSelectMode(notification)}
						width={playerCardWidthPix() * 1.5}
						height={playerCardWidthPix() * 1.5}
						anchor={0.5}
						x={getWindowWidth() / 2}
						y={textY(cardHeight) + notificationFontSize + ((playerCardWidthPix() * 1.5) / 2)}
					/>
					<Text
						x={getWindowWidth() / 2}
						y={textY(cardHeight)}
						text={notification.text}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={cardInNotificationPreview}
						autoWidth={true}
						cardActions={{}}
						onSelectCard={controller.selectNotificationCardPreview}
						onCardAction={() => {}}
						y={tableCenterY()}
					/>
				</React.Fragment>
			);
			break;
		case ENotificationAction.selectCards: {
			// Весь выбор на одном экране: карты отмечаются галочками, а OKEY меняет
			// их разом. Пока набрано не всё, кнопка притушена и не жмётся — тогда и
			// подпись говорит, сколько ещё осталось отметить.
			cardHeight = rowHeight(Object.keys(notification.cards).length);
			const {checkedNotificationCards} = controller;
			const isReady = checkedNotificationCards.length === notification.count;
			const okayWidth = playerCardWidthPix() * 1.5;
			notificationContent = (
				<React.Fragment>
					<Sprite
						texture={okayTexture}
						interactive={isReady}
						buttonMode={isReady}
						alpha={isReady ? 1 : 0.35}
						pointerdown={() => controller.selectCards(notification)}
						width={okayWidth}
						height={okayWidth}
						anchor={0.5}
						x={getWindowWidth() / 2}
						y={textY(cardHeight) + notificationFontSize * 2 + (okayWidth / 2)}
					/>
					{/* Под картами — что вообще требуется сделать, и уже под этим счёт
					    отмеченного: со счётом в одиночку окно не объясняет само себя.
					    Когда карта нужна одна, считать нечего — «отмечено 1 из 1» не
					    говорит ничего сверх того, что и так видно по самой карте. */}
					<Text
						x={getWindowWidth() / 2}
						y={textY(cardHeight)}
						text={notification.count === 1
							? `${notification.text}${isReady ? '\nЖми OKAY' : ''}`
							: isReady
								? `${notification.text}\nОтмечено ${notification.count} из ${notification.count} — жми OKAY`
								: `${notification.text}\nОтмечено ${checkedNotificationCards.length} из ${notification.count}`}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={null}
						autoWidth={true}
						checkedCardIds={checkedNotificationCards}
						cardActions={{}}
						onSelectCard={(cardUniqueId) => controller.toggleNotificationCardCheck(cardUniqueId, notification.count)}
						onCardAction={() => {}}
						y={tableCenterY()}
					/>
				</React.Fragment>
			);
			break;
		}
		case ENotificationAction.info:
			notificationContent = (
				<Text
					x={getWindowWidth() / 2}
					y={tableCenterY()}
					text={notification.text}
					anchor={0.5}
					style={getFontStyle(18, getWindowWidth() * 0.8)}
				/>
			);
			break;
	}
	if (!notificationContent) return null;

	return (
		<Container width={getWindowWidth()} height={getWindowHeight()}>
			<Container alpha={0.7} pointerdown={() => {}}>
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()} color={0}/>
			</Container>
			{/* Клик мимо карт снимает увеличение выбранной карты (карты лежат выше и
			    перехватывают клик первыми — pixi ищет попадание с конца списка). */}
			<Sprite
				texture={PIXI.Texture.WHITE}
				alpha={0}
				interactive={true}
				x={0}
				y={0}
				width={getWindowWidth()}
				height={getWindowHeight()}
				pointerdown={() => {controller.cardInNotificationPreview = null}}
			/>
			<Container width={getWindowWidth()} height={getWindowHeight()}>
				{notificationContent}
			</Container>
		</Container>
	)
});

const Notifier = observer(({controller}: INotifierProps) => {
	const notifications = controller.notifications;
	// length проверяем первым: чтение индекса за границей observable-массива
	// печатает варнинг mobx на каждый рендер.
	const notification = notifications.length ? notifications[0] : undefined;
	if (!notification) return null;
	return <Notification notification={notification} controller={controller}/>;
});

export default Notifier;
