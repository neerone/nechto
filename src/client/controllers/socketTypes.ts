// Shapes of the payloads the server sends over socket.io, modelled locally on the
// client (the authoritative formatters live in server scope and must not be imported
// across the client/server boundary). Keep these in sync with
// server/formatters/formatOutgoingEvents.ts.
import type { ECardType } from 'shared/enum/cards';
import type { EGameState } from 'shared/enum/common';
import type { ICardEvent } from 'shared/interfaces/cards';
import type { IFormatCardDraw, IFormatCardEffect, IFormatPanicCard, IFormatTradeContext } from 'shared/interfaces/common';
import type INotificationAction from 'shared/interfaces/notification';
import type { IGameLogEntry } from 'shared/interfaces/gameLog';
import type Player from 'client/models/Player';
import type { EPlayerActionType } from 'shared/enum/playerActions';

export interface IDeckPayload {
	count: number;
	topCardType: ECardType;
}

export interface IHandActionEntry {
	type: EPlayerActionType;
	[key: string]: unknown;
}

export type IPlayersMap = { [key: string]: Player | null };
export type IHandMap = { [key: string]: ICardEvent };
export type IHandActionsMap = { [key: string]: IHandActionEntry[] };

export interface IGameUpdatePayload {
	tradeContext: IFormatTradeContext[] | null;
	cardEffects: IFormatCardEffect[];
	cardDraws: IFormatCardDraw[];
	panicCard: IFormatPanicCard | null;
	players: IPlayersMap;
	playersList: string[];
	turnPlayerId: string | null;
	isClockwise: boolean;
	deck: IDeckPayload;
	gameLog: IGameLogEntry[];
	currentAction: INotificationAction | null;
	state: EGameState;
	currentPlayer: Player;
	hand: IHandMap;
	handActions: IHandActionsMap;
	hostPlayerId: string;
	isPlayerCanCancel: boolean;
}

export interface IGameConnectionSuccessPayload {
	players: IPlayersMap;
	player: Player;
	game: { id: string };
	currentPlayer: Player;
}

export interface ICommonErrorPayload {
	error: string;
}

export interface ILobbyGameItem {
	gameId: string;
	hostName: string;
	playersCount: number;
	isStarted: boolean;
}

export interface ILobbyUpdatePayload {
	games: ILobbyGameItem[];
}

export interface ITimerPayload {
	text: string;
	seconds: number;
	playerId: string;
}
