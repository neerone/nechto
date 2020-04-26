import {ENotificationAction} from 'shared/enum/notifications';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

interface INotificationActionCommon {
	text: string;
}

interface INotificationActionInfo {
	type: ENotificationAction.info
}

interface INotificationActionDecision {
	type: ENotificationAction.actionDecision,
	menu : {text: string, action: string}[]
}
interface INotificationActionOkayCard {
	type: ENotificationAction.okayCard,
	cards: ICardEvent[] | ICardPanic[];
}
interface INotificationActionSelectCard {
	type: ENotificationAction.selectCard,
	cards: ICardEvent[] | ICardPanic[];
}
interface INotificationActionPlayerSelect {
	type: ENotificationAction.playerSelect,
	playersToSelect: string[],
}

type INotificationAction = INotificationActionCommon &
	(INotificationActionDecision
	| INotificationActionInfo
	| INotificationActionOkayCard
	| INotificationActionSelectCard
	| INotificationActionPlayerSelect);

export default INotificationAction;
