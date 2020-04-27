import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {tenacityAct, tenacitySelect} from 'server/helpers/cardActions/offense/tenacity';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {suspicionAct, suspicionSelect} from 'server/helpers/cardActions/offense/suspicion';
import {positionswapAct, positionswapFinish, positionswapSelect} from 'server/helpers/cardActions/offense/positionswap';
import {flamethrowerAct, flamethrowerFinish, flamethrowerSelect} from 'server/helpers/cardActions/offense/flamethrower';
import {reelFishingRodsAct} from 'server/helpers/cardActions/offense/reelFishingRods';
import {seductionAct, seductionSelect} from 'server/helpers/cardActions/offense/seduction';
import {whiskeyAct} from 'server/helpers/cardActions/offense/whiskey';
import {quarantineAct, quarantineSelect} from 'server/helpers/cardActions/offense/quarantine';
import {axeAct, axeSelect} from 'server/helpers/cardActions/offense/axe';
import {lookAroundAct} from 'server/helpers/cardActions/offense/lookAround';
import {analysisAct, analysisSelect} from 'server/helpers/cardActions/offense/analysis';
import {EEventID} from 'shared/enum/cards';
import {fearAct} from 'server/helpers/cardActions/defense/fear';
import {missAct} from 'server/helpers/cardActions/defense/miss';
import {noThanksAct} from 'server/helpers/cardActions/defense/noThanks';
import {barricadeAct, barricadeSelect} from 'server/helpers/cardActions/offense/barricade';
import {blindDateSelect} from 'server/helpers/cardActions/panic/blindDate';
import {oneTwoPlayerSelect} from 'server/helpers/cardActions/panic/oneTwo';
import {onlyBetweenUsSelect} from 'server/helpers/cardActions/panic/onlyBetweenUs';
import {forgetfullnessSelect} from 'server/helpers/cardActions/panic/forgetfulness';

export const actCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	const card = player.getCardByUniqueId(cardUniqueId);
	if (!card) {
		throw new Error('Похоже карта не была найдена у игрока ' + player.nickname + ' c ID ' + card.uniqueId);
	}
	switch (card.id) {
		case EEventID.tenacity:
			tenacityAct({card, player, game}); break;
		case EEventID.suspicion:
			suspicionAct({player, game, card}); break;
		case EEventID.positionswap:
			positionswapAct({player, game, card}); break;
		case EEventID.flamethrower:
			flamethrowerAct({player, game, card}); break;
		case EEventID.reelFishingRods:
			reelFishingRodsAct({player, game, card}); break;
		case EEventID.barricade:
			barricadeAct({player, game, card}); break;
		case EEventID.seduction:
			seductionAct({player, game, card}); break;
		case EEventID.whiskey:
			whiskeyAct({player, game, card}); break;
		case EEventID.quarantine:
			quarantineAct({player, game, card}); break;
		case EEventID.axe:
			axeAct({player, game, card}); break;
		case EEventID.lookaround:
			lookAroundAct({player, game, card}); break;
		case EEventID.analysis:
			analysisAct({player, game, card}); break;

			//DEFENSIVE
		case EEventID.noThanks:
			noThanksAct({player, game, card}); break;
		case EEventID.fear:
			fearAct({player, game, card}); break;
		case EEventID.miss:
			missAct({player, game, card}); break;
	}
};

export const selectCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	const {turnContext} = game;
	if (!turnContext) return;
	switch (turnContext.type) {
		case ETurnContextType.tenacityCardSelect:
			return tenacitySelect({game, cardUniqueId, player})
		case ETurnContextType.blindDateCardSelect:
			return blindDateSelect({game, cardUniqueId, player})
		case ETurnContextType.forgetfullnessSelect:
			return forgetfullnessSelect({game, cardUniqueId, player})
	}
};

export const selectPlayer = ({game, selectedPlayerId, player, actionContext} : {game: Game, player: Player, selectedPlayerId: string, actionContext?:any}) => {
	const {turnContext} = game;
	switch (turnContext.type) {
		case ETurnContextType.suspicionPersonSelect:
			return suspicionSelect({game, selectedPlayerId, player});
		case ETurnContextType.positionswap:
			return positionswapSelect({game, selectedPlayerId, player});
		case ETurnContextType.burn:
			return flamethrowerSelect({game, selectedPlayerId, player});
		case ETurnContextType.barricadePersonSelect:
			return barricadeSelect({game, selectedPlayerId, player})
		case ETurnContextType.seduction:
			return seductionSelect({game, selectedPlayerId, player})
		case ETurnContextType.quarantinePersonSelect:
			return quarantineSelect({game, selectedPlayerId, player})
		case ETurnContextType.axePersonSelect:
			return axeSelect({game, selectedPlayerId, player})
		case ETurnContextType.analysisPersonSelect:
			return analysisSelect({game, selectedPlayerId, player})
		case ETurnContextType.oneTwoPersonSelect:
			return oneTwoPlayerSelect({game, selectedPlayerId, player})
		case ETurnContextType.onlyBetweenUsPersonSelect:
			return onlyBetweenUsSelect({game, selectedPlayerId, player})
	}

}


export const playerActionDecision = ({game, action, player} : {game: Game, player: Player, action: string}) => {
	player.currentAction = null;
	switch (action) {
		case "cancelSwap":
		case "swap":
			return positionswapFinish({game, player, action});
		case "burn":
		case "noFire":
			return flamethrowerFinish({game, player, action});
	}

}


