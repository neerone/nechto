import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import type INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import {map} from 'lodash';
import cn from 'classnames';


interface IActionInteracterProps {
	controller:  GameController;
}

// Под стеком действий: сам вопрос написан там, светящейся плашкой требования
// (см. actionStackModel/getPendingEntry), и затемнение меню его закрывать не
// должно.
const MENU_Z_INDEX = 99;

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
	// Текст требования переехал в стек действий отдельной плашкой — здесь остаётся
	// только меню выбора, и когда его нет, показывать нечего.
	const menu = renderAction(action, controller);
	if (!menu) return null;
	return <div className={"action-menu-wrapper"} style={{zIndex: MENU_Z_INDEX}}>{menu}</div>
});


export default ActionInteracter;
