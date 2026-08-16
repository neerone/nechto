import React from 'react';
import {map} from 'lodash';
import cn from 'classnames';
import {resources} from 'client/resources/resources';
import {formatNickname} from 'client/components/table/PlayerBadge/PlayerBadge';
import type {IGameEndPlayer} from 'shared/interfaces/notification';

// Финальный экран партии: две шеренги — победившая команда и проигравшая. Роли
// до этого момента были тайной (сервер отдаёт их только в конце, см.
// formatGameEndTeams), и здесь стол наконец показывают целиком: кто был человеком,
// кто заражённым и кто всё это время был Нечто.
//
// Каждый стоит своим лицом — тем же, каким сидел за столом (см. PlayerBadge):
// Нечто закрыто своей мордой, заражённый — своим же лицом со щупальцами, человек
// — чистым. Не дожившие до конца стоят в шеренге своей команды затенёнными: они
// её часть, просто их партия кончилась раньше.

const faceOf = (player: IGameEndPlayer): string | undefined => {
	if (player.isThing) return resources.thingAvatar;
	if (player.avatar === '') return undefined;
	const index = Number(player.avatar);
	const faces = player.isInfected ? resources.infectedAvatars : resources.avatars;
	return faces[index % faces.length];
};

const EndPlayer = ({player}: {player: IGameEndPlayer}) => {
	const face = faceOf(player);
	return <div className={cn('endPlayer', {isDead: !player.isAlive})}>
		<div className={'endPlayerFace'}>
			{face ? <img className={'endPlayerImage'} src={face} alt={''}/> : null}
			{/* Череп — поверх затенённого лица: одно только затенение читается как
			    «отключился», а не как «выбыл». */}
			{!player.isAlive ? <span className={'endPlayerSkull'}>💀</span> : null}
		</div>
		{/* Ник — тот же обрубок, что подписан на кружке за столом (см.
		    formatNickname): в шеренге узнают того же соседа, что и в комнате, а
		    длинные ники не разъезжаются по строке. */}
		<div className={'endPlayerNick'}>{formatNickname(player.nickname)}</div>
	</div>;
};

// Чья это шеренга. Команду видно по лицам, но подписью её видно сразу — а на
// столе, где Нечто заразило всех до единого, шеренга остаётся вообще одна, и без
// подписи не сказать, кто в ней стоит.
const teamName = (players: IGameEndPlayer[]) =>
	players.some((player) => player.isThing || player.isInfected) ? 'Нечто' : 'Люди';

const EndTeam = ({title, players, isWinner}: {title: string, players: IGameEndPlayer[], isWinner: boolean}) => {
	if (!players.length) return null;
	return <div className={cn('endTeam', {isWinner})}>
		<div className={'endTeamTitle'}>
			{title}
			<span className={'endTeamSide'}>{teamName(players)}</span>
		</div>
		<div className={'endTeamRow'}>
			{map(players, (player) => <EndPlayer key={player.id} player={player}/>)}
		</div>
	</div>;
};

interface IGameEndTeamsProps {
	text: string;
	winners: IGameEndPlayer[];
	losers: IGameEndPlayer[];
}

const GameEndTeams = ({text, winners, losers}: IGameEndTeamsProps) => (
	<div className={'gameEndTeams'}>
		<div className={'gameEndText'}>{text}</div>
		<EndTeam title={'Победители'} players={winners} isWinner={true}/>
		<EndTeam title={'Проигравшие'} players={losers} isWinner={false}/>
	</div>
);

export default GameEndTeams;
