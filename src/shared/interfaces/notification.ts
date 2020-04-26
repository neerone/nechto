import {ENotificationAction} from 'shared/enum/notifications';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

interface INotificationActionCommon {
	text: string;
}

interface INotificationActionInfo {
	type: ENotificationAction.info
}

export interface INotificationActionDecision {
	type: ENotificationAction.actionDecision,
	menu : {text: string, action: string}[]
}
export interface INotificationActionOkayCard {
	type: ENotificationAction.okayCard,
	cards: ICardEvent[] | ICardPanic[];
}
export interface INotificationActionSelectCard {
	type: ENotificationAction.selectCard,
	cards: ICardEvent[] | ICardPanic[];
}
export interface INotificationActionPlayerSelect {
	type: ENotificationAction.playerSelect,
	playersToSelect: string[],
}

export interface INotificationActionDefenseTradeCard {
	type: ENotificationAction.defenseTradeCard
}

export interface INotificationActionOffenseTradeCard {
	type: ENotificationAction.offenseTradeCard
}

export interface INotificationActionTurnCard {
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
