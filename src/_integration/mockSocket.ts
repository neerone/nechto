import {Player} from 'server/models/Player';
import {EPlayerState} from 'shared/enum/player';

//let isTest = true;
class MockSocket {
	spy: any
	isTest: boolean
	constructor(isTestTag) {
		this.isTest = isTestTag;
		if (isTestTag) {
			const mockCallback = jest.fn();
			this.spy = mockCallback
		}
	}
	on(eventType, payload) {
		console.log('')
	}
	emit(eventType, payload) {
		if (this.isTest) {
			this.spy(eventType, payload)
		}
	}
	join(socketRoom) {
	}
}

class MockSocketServer {

	to(roomName) {
		return {
			emit: (eventType, eventPayload) => {
			}
		}
	}
}

export const createPlayer = (isTestTag = false) => {
	const socket = new MockSocket(isTestTag);
	return new Player({ socket });
}

export const createDoor = (isTestTag = false) => {
	const socket = new MockSocket(isTestTag);
	const door = new Player({ socket });
	door.state = EPlayerState.door;
	door.nickname = 'ДВЕРЬ';
	return door;
}

export const createMockSocketServer = () => {
	const server = new MockSocketServer();
	return server;
}
