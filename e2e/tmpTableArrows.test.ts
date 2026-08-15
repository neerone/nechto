import {test, Browser} from '@playwright/test';
import {GameSession, startGame} from './helpers/nechto';

// ВРЕМЕННЫЙ спек: снимает столешницу при ходе по часовой и против неё.
const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];
const SHOTS = '/tmp/claude-1000/-home-neer-projects-nechto/d0c79aa4-a6d8-4b88-88ec-be080246c141/scratchpad';

test.describe.serial('стрелки на столе', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('снимок стола в обе стороны', async () => {
		const page = session.page('Alice');
		await page.setViewportSize({width: 1280, height: 900});

		await session.arrange({players: NICKS, turn: 'Alice', clockwise: true});
		await page.waitForTimeout(1500);
		await page.screenshot({path: `${SHOTS}/table-clockwise.png`});

		await session.arrange({players: NICKS, turn: 'Alice', clockwise: false});
		await page.waitForTimeout(1500);
		await page.screenshot({path: `${SHOTS}/table-counter.png`});
	});
});
