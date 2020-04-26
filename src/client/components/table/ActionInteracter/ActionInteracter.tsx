import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';


interface IActionInteracterProps {
	controller:  GameController;
}

const ActionInteracter = ({controller}: IActionInteracterProps) => {
	return <span>{JSON.stringify(controller.currentAction)}</span>
};


export default ActionInteracter;
