import React from 'react';
import {each, find, map} from 'lodash';
import cn from 'classnames';
import type GameController from 'client/controllers/gameController';
import {renderCardMentions} from 'client/components/hint/CardHint';

// Разбор текста строки лога: ники игроков красим, названия карт превращаем в
// подсказки. Сервер пишет свободной строкой (см. game.addLog), поэтому и то, и
// другое узнаётся по тексту.

// Цвет ника = порядковый номер игрока (player.color — это индекс бейджа).
const NICK_COLORS = [
	'#ff6b6b', '#4ecdc4', '#ffd93d', '#a29bfe', '#6ab04c',
	'#f78fb3', '#f0932b', '#7ed6df', '#e056fd', '#badc58',
	'#ff9f43',
];

export interface INickHighlight {
	nickname: string;
	color: string;
	isYou: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getNickHighlights = (controller: GameController): INickHighlight[] => {
	const highlights: INickHighlight[] = [];
	each(controller.players, (player) => {
		if (!player || !player.nickname) return;
		const colorIndex = Number(player.color);
		highlights.push({
			nickname: player.nickname,
			color: NICK_COLORS[(isNaN(colorIndex) ? 0 : colorIndex) % NICK_COLORS.length] as string,
			isYou: player.isYou,
		});
	});
	// Длинные ники первыми: иначе ник, входящий в состав другого, разрежет его на части.
	return highlights.sort((a, b) => b.nickname.length - a.nickname.length);
};

// Кто сделал — тот, чей ник в строке назван первым: «Игрок X играет карту на Y»,
// «Игроки X и Y меняются картами». Карточке в стеке этого хватает, чтобы носить
// цвет своего игрока и без подсказки.
export const getActorHighlight = (text: string, highlights: INickHighlight[]): INickHighlight | undefined => {
	let actor: INickHighlight | undefined;
	let actorAt = Infinity;
	each(highlights, (highlight) => {
		const at = text.indexOf(highlight.nickname);
		if (at < 0 || at >= actorAt) return;
		actorAt = at;
		actor = highlight;
	});
	return actor;
};

// Ники разбираем первыми: игрок с ником «Топор» остаётся игроком, а не картой.
export const renderLogText = (text: string, highlights: INickHighlight[]) => {
	if (!highlights.length) return renderCardMentions(text);
	const pattern = new RegExp(`(${map(highlights, (h) => escapeRegExp(h.nickname)).join('|')})`, 'g');
	return map(text.split(pattern), (part, index) => {
		const highlight = find(highlights, (h) => h.nickname === part);
		if (!highlight) return <React.Fragment key={index}>{renderCardMentions(part)}</React.Fragment>;
		return <span
			key={index}
			className={cn('logNick', {isYou: highlight.isYou})}
			style={{color: highlight.color}}
		>
			{part}
		</span>;
	});
};
