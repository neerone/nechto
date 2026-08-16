import React from 'react';
import './style.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import Deck from 'client/components/table/Deck/Deck';
import ActionStack from 'client/components/actionStack/ActionStack';
import Room from 'client/components/table/Room/Room';
import Hand from 'client/components/table/Hand/Hand';
import Notifier from 'client/components/table/notifier/notifier';
import PanicCard from 'client/components/table/PanicCard/PanicCard';
import {Helmet} from "react-helmet";
import ActionInteracter from 'client/components/table/ActionInteracter/ActionInteracter';
import ActionCanceler from 'client/components/table/ActionCanceler/ActionCanceler';
import TableMenu from 'client/components/table/TableMenu/TableMenu';
import {StageBoundary} from 'client/components/table/StageBoundary';
import {TableStage} from 'client/components/table/TableStage';
import {CardHintOverlay} from 'client/components/hint/CardHint';


interface ITableProps {
	controller: GameController
}


const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer:player, hand} = controller;
		if (!player || !hand) return null;

		return (
			<div className={"gameTable"}>
				<ActionStack controller={controller}/>
				<TableMenu controller={controller}/>
				<ActionInteracter controller={controller}/>
				<StageBoundary>
					<TableStage>
						{/* Стол рисуется слоями по глубине: сначала дальняя половина
						    игроков, потом столешница (она их и подрезает), потом всё,
						    что на ней лежит, и только потом ближние игроки. Колода с
						    паникой лежат на столешнице, поэтому идут детьми Room —
						    ровно в этот промежуток. */}
						<Room controller={controller}>
							<Deck controller={controller} />
							{/* Сразу над колодой, но ПОД всем остальным: паника лежит на
							    столе, а не поверх интерфейса — бейджи, рука и её меню
							    остаются доступными (в цепной реакции ими и ходят). */}
							<PanicCard controller={controller} />
						</Room>
						<Hand controller={controller} />
						<ActionCanceler controller={controller} />
						<Notifier controller={controller} />
					</TableStage>
				</StageBoundary>
				{/* Подсказка по тому, что нарисовано на столе: дверь, карантин. */}
				<CardHintOverlay/>

				{/*<div className={"debug-div"}><div></div></div>*/}
	            <Helmet>
	                <title>{player.nickname}</title>
	            </Helmet>
			</div>
		)
});

export default Table;
