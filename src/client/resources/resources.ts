import tenacity from "client/resources/cards/tenacity.png";
import fear from "client/resources/cards/fear.png";
import suspicion from "client/resources/cards/suspicion.png";
import leaveMeAlone from "client/resources/cards/leaveMeAlone.png";
import positionswap from "client/resources/cards/positionswap.png";
import flamethrower from "client/resources/cards/flamethrower.png";
import reelFishingRods from "client/resources/cards/reelFishingRods.png";
import axe from "client/resources/cards/axe.png";
import lookaround from "client/resources/cards/lookaround.png";
import whiskey from "client/resources/cards/whiskey.png";
import barricade from "client/resources/cards/barricade.png";
import seduction from "client/resources/cards/seduction.png";
import infect from "client/resources/cards/infect.png";
import quarantine from "client/resources/cards/quarantine.png";
import noFire from "client/resources/cards/noFire.png";
import analysis from "client/resources/cards/analysis.png";
import noThanks from "client/resources/cards/noThanks.png";
import miss from "client/resources/cards/miss.png";
import threeFour from "client/resources/cards/threeFour.png";
import chainReaction from "client/resources/cards/chainReaction.png";
import blindDate from "client/resources/cards/blindDate.png";
import oldRopes from "client/resources/cards/oldRopes.png";
import oneTwo from "client/resources/cards/oneTwo.png";
import onlyBetweenUs from "client/resources/cards/onlyBetweenUs.png";
import youCallThisParty from "client/resources/cards/youCallThisParty.png";
import goAway from "client/resources/cards/goAway.png";
import oops from "client/resources/cards/oops.png";
import friendship from "client/resources/cards/friendship.png";
import forgetfulness from "client/resources/cards/forgetfulness.png";
import recognitionTime from "client/resources/cards/recognitionTime.png";
import eventBack from "client/resources/cards/eventBack.png";
import panicBack from "client/resources/cards/panicBack.png";
import thing from "client/resources/cards/thing.png";

import barricadeBadge from "client/resources/images/barricade_badge.png";
import disconnected from "client/resources/images/disconnected.png";
import glowEffect from "client/resources/images/gloweffect.png";
import playerbadgeGlow from "client/resources/images/playerbadgeGlow.png";
import noise from "client/resources/images/noise.jpg";
// Столешница: круглый люк, увиденный сверху. В эллипс стола он не вписывается, а
// растягивается — это тот же круг, только в проекции стола (см. TableSurface).
import tableTop from "client/resources/images/table.jpg";
import deckCounterBg from "client/resources/images/deckCounterBg.png";
// Отпечаток пальца в тот же неоново-зелёный, что и ладонь на кнопке OKAY: им
// «подписывают» выбранные карты в окне множественного выбора (см. FingerStamp
// в HandComponent).
import fingerPrint from "client/resources/images/fingerPrint.png";
// Цепи карантина крест-накрест с замком: ложатся ПОВЕРХ кружка, кто бы под ними
// ни был (см. QuarantineSkin), поэтому фон прозрачный, а не картинка во всю
// площадь кружка.
import quarantineChains from "client/resources/images/quarantine_chains.png";
// Нечто во весь рост: им залит кружок игрока, про которого известно, что он
// нечто (см. StatusSkin). Отдельная картинка, а не иллюстрация с карты «Нечто»:
// эта нарисована сразу под кружок и берётся целиком, без кадрирования.
import thingAvatar from "client/resources/images/thing_avatar.jpg";

import playerBadge1 from "client/resources/images/playerBadges/1.png";
import playerBadge2 from "client/resources/images/playerBadges/2.png";
import playerBadge3 from "client/resources/images/playerBadges/3.png";
import playerBadge4 from "client/resources/images/playerBadges/4.png";
import playerBadge5 from "client/resources/images/playerBadges/5.png";
import playerBadge6 from "client/resources/images/playerBadges/6.png";
import playerBadge7 from "client/resources/images/playerBadges/7.png";
import playerBadge8 from "client/resources/images/playerBadges/8.png";
import playerBadge9 from "client/resources/images/playerBadges/9.png";
import playerBadge10 from "client/resources/images/playerBadges/10.png";
import playerBadge11 from "client/resources/images/playerBadges/11.png";
import playerBadgeThing from "client/resources/images/playerBadges/thing.png";
import playerBadgeInfected from "client/resources/images/playerBadges/infected.png";

// Лица игроков: ими залит кружок за столом (см. BadgeBody). Кадрированы под его
// пропорции (badgeAspect), поэтому вписываются в него без подгонки. Раздаёт их
// сервер на старте партии, по одной на человека (см. gameStarter).
import avatar1 from "client/resources/images/avatars/1.jpg";
import avatar2 from "client/resources/images/avatars/2.jpg";
import avatar3 from "client/resources/images/avatars/3.jpg";
import avatar4 from "client/resources/images/avatars/4.jpg";
import avatar5 from "client/resources/images/avatars/5.jpg";
import avatar6 from "client/resources/images/avatars/6.jpg";
import avatar7 from "client/resources/images/avatars/7.jpg";
import avatar8 from "client/resources/images/avatars/8.jpg";

// Те же лица, но заражённые: щупальца по щеке и зелёные глаза. Ими закрывается
// кружок игрока, про которого известно, что он заражён (см. StatusSkin), — по
// номеру его же аватарки, так что человек за столом остаётся узнаваемым. Кадры
// те же, поэтому лицо не прыгает в момент, когда о заражении узнали.
import infectedAvatar1 from "client/resources/images/avatars/infected/1.jpg";
import infectedAvatar2 from "client/resources/images/avatars/infected/2.jpg";
import infectedAvatar3 from "client/resources/images/avatars/infected/3.jpg";
import infectedAvatar4 from "client/resources/images/avatars/infected/4.jpg";
import infectedAvatar5 from "client/resources/images/avatars/infected/5.jpg";
import infectedAvatar6 from "client/resources/images/avatars/infected/6.jpg";
import infectedAvatar7 from "client/resources/images/avatars/infected/7.jpg";
import infectedAvatar8 from "client/resources/images/avatars/infected/8.jpg";

import cardAct from "client/resources/images/buttons/act.png";
import cardDiscard from "client/resources/images/buttons/discard.png";
import cardTrade from "client/resources/images/buttons/trade.png";

import okay from "client/resources/images/buttons/okay.png";


/* PLAYER STATUSES */
import playerStatusQuestion from 'client/resources/images/playerStatuses/question.png';
import playerStatusThing from 'client/resources/images/playerStatuses/thing.png';
import playerStatusInfected from 'client/resources/images/playerStatuses/infected.png';
import playerStatusClear from 'client/resources/images/playerStatuses/clear.png';

const resources = {
	tenacity,
	fear,
	suspicion,
	leaveMeAlone,
	positionswap,
	flamethrower,
	reelFishingRods,
	axe,
	lookaround,
	whiskey,
	barricade,
	seduction,
	infect,
	quarantine,
	noFire,
	analysis,
	noThanks,
	miss,
	threeFour,
	chainReaction,
	blindDate,
	oldRopes,
	oneTwo,
	onlyBetweenUs,
	youCallThisParty,
	goAway,
	oops,
	friendship,
	forgetfulness,
	recognitionTime,
	eventBack,
	panicBack,
	thing,

	glowEffect,
	playerbadgeGlow,
	deckCounterBg,
	fingerPrint,
	noise,
	tableTop,
	thingAvatar,
	quarantineChains,

	cardAct,
	cardDiscard,
	cardTrade,

	okay,

	playerStatusQuestion,
	playerStatusThing,
	playerStatusInfected,
	playerStatusClear,

	playerBadges: {
		0: playerBadge1,
		1: playerBadge2,
		2: playerBadge3,
		3: playerBadge4,
		4: playerBadge5,
		5: playerBadge6,
		6: playerBadge7,
		7: playerBadge8,
		8: playerBadge9,
		9: playerBadge10,
		10: playerBadge11,
		'door': barricadeBadge,
		'disconnected': disconnected,
		'thing': playerBadgeThing,
		'infected': playerBadgeInfected,
	},

	// Порядок важен: сервер присылает номер аватарки в этом списке.
	avatars: [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8],

	// Заражённые лица идут тем же порядком: номер у игрока один, и по нему
	// берётся то чистое лицо, то заражённое.
	infectedAvatars: [
		infectedAvatar1, infectedAvatar2, infectedAvatar3, infectedAvatar4,
		infectedAvatar5, infectedAvatar6, infectedAvatar7, infectedAvatar8,
	],
};

export {resources};
