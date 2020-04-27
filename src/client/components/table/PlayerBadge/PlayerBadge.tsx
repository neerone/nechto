import React from 'react';
import './styles.scss';
import cx from 'classnames';
import {range, map} from 'lodash';


interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	inTurn: boolean;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	quarantine: number;
	isYou: boolean;
	isInjured: boolean;
	isThing: boolean;
}

const formatNickname = (nickname) => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

const TurnBadge = () => {
	return <div className={'turnBadge'}/>
};

const InjureBadge = () => {
	return <div className={'infectBadge'}/>
};
const ThingBadge = () => {
	return <div className={'thingBadge'}/>
};
const Quarantine = ({quarantine}) => {
	return quarantine ? (
		<div className={'quarantineBadge'}>
			{ map(range(quarantine), (q) => <div key={q} className={'quarantineDot'}/>) }
		</div>
	) :  null;
}

const PlayerBadge = ({nickname, color, inTurn = false, canBeSelected = false, onSelect = null, id, isDoor, quarantine, isYou, isInjured, isThing}: IPlayerBadgeProps) => {
	return (
		<div className={cx({playerBadge: true, canBeSelected, isDoor, onQuarantine: quarantine > 0, isYou })} style={{background: color}} onClick={() => (onSelect && canBeSelected) ? onSelect(id) : null}>
			{ !isDoor && (
				<React.Fragment>
					{inTurn && <TurnBadge/>}
					{isInjured && <InjureBadge/>}
					{isThing && <ThingBadge/>}
					{formatNickname(nickname)}
					<Quarantine quarantine={quarantine}/>
				</React.Fragment>
			)}

		</div>
	)
};

export default PlayerBadge;
