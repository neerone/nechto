import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {each, isEqual} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {Player} from 'server/models/Player';
import {ICardEvent} from 'shared/interfaces/cards';
import {getNextChainReactionPlayer} from 'server/helpers/cardActions/panic/chainReaction';
import {checkAllDeckCardsTestEdition} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('chainReaction test',  () => {

	it('chainReaction card', () => {
		const [gameServer, game, offensePlayer, door, BPlayer, CPlayer] = createMockGameServer();
		door.state = EPlayerState.door;
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.chainReaction));
		game.changeTurn(offensePlayer.id);


		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext.type).toBe(ETurnContextType.chainReaction);

		const startPlayer = (game.turnContext as any).startPlayer;
		expect(startPlayer).not.toBe(undefined);

		let tradedCards: {player: Player, card: ICardEvent}[] = [];

		each(game.players, pl => {
			if (pl.state === EPlayerState.door) return;
			const card = pl.getRandomPlayableCard();
			tradedCards.push({player: pl, card});
			console.log(pl.nickname)
			expect(pl.turnState).toBe(ETurnState.inOffenseTrade);
			expect(game.turnContext.type).toBe(ETurnContextType.chainReaction);

			//console.log('DIFF', difference((game.turnContext as any).playersPick, tradedCards));
			testPlayerAction(gameServer, game, {
				player:pl,
				cardUniqueId: card.uniqueId,
				actionType: EPlayerActionType.cardTrade
			});
			if ((game.turnContext as any) && (game.turnContext as any).playersPick) {
				expect(isEqual((game.turnContext as any).playersPick, tradedCards)).toBe(true);
			} else {

				expect(game.turnContext).toBe(null);
				each(tradedCards, ({player: tradedPlayer, card:tradedCard}) => {
					const nextPlayer = getNextChainReactionPlayer({currentPlayer: tradedPlayer, game});
					expect(nextPlayer.hand).toContainEqual(
						expect.objectContaining({uniqueId: tradedCard.uniqueId})
					)
				})

				//each(game.players, (pl) => {console.log('PLAYER STATE', pl.nickname, pl.turnState)})

				//Два некста, потому что была дверь
				const nextPlayerAfterStarter = startPlayer.getNextPlayer().getNextPlayer();
				expect(nextPlayerAfterStarter.turnState).toBe(ETurnState.inCardAction)


			}
		})


		//Не проверяем, потому что цифра не сойдется. Мы дверь зафейкали
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


	it('chainReaction card', () => {
		const [gameServer, game, offensePlayer, APlayer, BPlayer, CPlayer] = createMockGameServer();
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.chainReaction));
		game.changeTurn(offensePlayer.id);


		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext.type).toBe(ETurnContextType.chainReaction);

		const startPlayer = (game.turnContext as any).startPlayer;
		expect(startPlayer).not.toBe(undefined);

		let tradedCards: {player: Player, card: ICardEvent}[] = [];

		each(game.players, pl => {
			if (pl.state === EPlayerState.door) return;
			const card = pl.getRandomPlayableCard();
			tradedCards.push({player: pl, card});
			console.log(pl.nickname)
			expect(pl.turnState).toBe(ETurnState.inOffenseTrade);
			expect(game.turnContext.type).toBe(ETurnContextType.chainReaction);

			//console.log('DIFF', difference((game.turnContext as any).playersPick, tradedCards));
			testPlayerAction(gameServer, game, {
				player:pl,
				cardUniqueId: card.uniqueId,
				actionType: EPlayerActionType.cardTrade
			});
			if ((game.turnContext as any) && (game.turnContext as any).playersPick) {
				expect(isEqual((game.turnContext as any).playersPick, tradedCards)).toBe(true);
			} else {

				expect(game.turnContext).toBe(null);
				each(tradedCards, ({player: tradedPlayer, card:tradedCard}) => {
					const nextPlayer = getNextChainReactionPlayer({currentPlayer: tradedPlayer, game});
					expect(nextPlayer.hand).toContainEqual(
						expect.objectContaining({uniqueId: tradedCard.uniqueId})
					)
				})

				//один некст, потому что следующий игрок не дверь
				const nextPlayerAfterStarter = startPlayer.getNextPlayer();
				expect(nextPlayerAfterStarter.turnState).toBe(ETurnState.inCardAction)
			}
		})

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


});
