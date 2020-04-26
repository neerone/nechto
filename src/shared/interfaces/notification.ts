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

interface INotificationActionDefenseTradeCard {
	type: ENotificationAction.defenseTradeCard
}

interface INotificationActionOffenseTradeCard {
	type: ENotificationAction.offenseTradeCard
}

interface INotificationActionTurnCard {
	type: ENotificationAction.turnCard
}

type INotificationAction = INotificationActionCommon &
	(INotificationActionDecision
	| INotificationActionInfo
	| INotificationActionOkayCard
	| INotificationActionSelectCard
	| INotificationActionPlayerSelect
	| INotificationActionDefenseTradeCard
	| INotificationActionOffenseTradeCard
	| INotificationActionTurnCard);

export default INotificationAction;
