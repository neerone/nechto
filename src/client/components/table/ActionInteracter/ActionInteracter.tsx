import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import type INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import {map} from 'lodash';
import cn from 'classnames';
import {getZIndex} from 'client/components/actionStack/ActionStack';


interface IActionInteracterProps {
	controller:  GameController;
}

const renderAction = (action: INotificationAction, controller: GameController) => {
	if (action.type !== ENotificationAction.actionDecision && action.type !== ENotificationAction.gameEnd) return null;
	// Кнопка по умолчанию: её сервер нажмёт сам, когда выйдет время (см.
	// server/helpers/askDecision). Отсчёт идёт прямо на ней — молчание тоже ход,
	// и игрок должен видеть, сколько у него осталось и что именно случится.
	const defaultAction = action.type === ENotificationAction.actionDecision ? action.defaultAction : undefined;
	const secondsLeft = controller.decisionSecondsLeft;
	const seconds = action.type === ENotificationAction.actionDecision ? action.seconds : undefined;
	return (
		<div className={"menu-wrapper"}>
			<div className={"centeredNotificationRow column"}>
				{map(action.menu, ({text, action}) => {
					const isCountingDown = secondsLeft !== null && !!seconds && action === defaultAction;
					return (<div
						key={action}
						className={cn('okayNotificationButton', {counting: isCountingDown})}
						onClick={() => controller.actionDecision(action)}
					>
						{isCountingDown && <div className={'countdown-fill'} style={{width: (secondsLeft / seconds) * 100 + '%'}}/>}
						<div className={'button-text'}>{text}</div>
						{isCountingDown && <div className={'countdown-seconds'}>{secondsLeft}</div>}
					</div>)
				})}
			</div>
		</div>
	);
}

const ActionInteracter = observer(({controller}: IActionInteracterProps) => {
	const notifications = controller.notifications;
	const firstNotification = notifications.length ? notifications[0] : undefined;
	const endGameNotification = (firstNotification && firstNotification.type === ENotificationAction.gameEnd) ? firstNotification : null;
	const action = endGameNotification ? endGameNotification : controller.currentAction
	if  (!action) return null;
	// Стек действий рассказывает, что уже случилось, но не что от тебя хотят —
	// это только на бейдже, поэтому он крупный и пульсирует.
	return <div className={"interaction-badge-wrapper"} style={{zIndex: getZIndex(controller)}}>
		<div className={cn("interaction-badge", "big")}>
			{action.text}
		</div>
		{ renderAction(action, controller) }
	</div>
});


export default ActionInteracter;
