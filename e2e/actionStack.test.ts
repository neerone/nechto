import {test, expect, Browser, Page} from '@playwright/test';
import {GameSession, startGame, fill} from './helpers/nechto';

// Стек действий — то, чем заменена лента логов: каждое законченное действие на
// столе кладётся отдельной карточкой, свежая приезжает справа, самая старая
// улетает влево. Проверяем, что по стеку читается всё то же, что читалось по
// логу: тип действия, его текст и названные в нём карты.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

// Стек уходит под канвас, пока висят уведомления (см. getZIndex) — разбираем их,
// иначе карточки не поймать указателем.
const clearNotifications = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		const gc = (window as unknown as {__nechto: {
			notifications: unknown[];
			hidENotificationAction(): void;
		}}).__nechto;
		while (gc.notifications.length) gc.hidENotificationAction();
	});
};

test.describe.serial('Стек действий', () => {
	let session: GameSession;
	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});
	test.afterAll(async () => {
		await session.close();
	});

	test('разыгранная карта ложится в стек своей картинкой и раскрывается подсказкой', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['axe']), Bob: fill([], 4)},
			quarantine: {Bob: 3},
		});
		await session.play('Alice', 'axe');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.gameLog.some((l) => l.includes('Топор')));

		const page = session.page('Alice');
		await clearNotifications(page);

		// Строку «играет карту "Топор" на Bob» стек кладёт картинкой самой карты —
		// знак типа поверх неё не рисуется, карта говорит сама за себя.
		const tile = page.locator('.actionSlot[data-action-card="axe"]').last();
		await expect(tile).toBeVisible();
		await expect(tile.locator('.actionArt')).toBeVisible();
		await expect(tile.locator('.actionIcon')).toHaveCount(0);

		// Наведение раскрывает подсказку с полным текстом действия.
		await tile.hover();
		const hint = page.locator('[data-hint-popup] .actionHint');
		await expect(hint).toBeVisible();
		await expect(hint.locator('.actionHintLabel')).toHaveText('Карта');
		await expect(hint.locator('.actionHintText')).toContainText('Топор');

		// Увели курсор — подсказка ушла.
		const viewport = page.viewportSize()!;
		await page.mouse.move(1, viewport.height - 1);
		await expect(page.locator('[data-hint-popup]')).toHaveCount(0);
	});

	test('клик прикалывает подсказку, а карта в её тексте показывается целиком', async () => {
		const page = session.page('Alice');
		await clearNotifications(page);
		const tile = page.locator('.actionSlot[data-action-card="axe"]').last();

		// Тап (на мобиле наведения нет) — окошко остаётся висеть само по себе.
		await tile.click();
		const viewport = page.viewportSize()!;
		await page.mouse.move(1, viewport.height - 1);
		await expect(page.locator('[data-hint-popup] .actionHint')).toHaveCount(1);

		// Названия карт внутри подсказки — сами подсказки: карту видно целиком и
		// крупно, иначе её текст не прочитать.
		const mention = page.locator('[data-hint-popup] .actionHintText .cardMention').first();
		await expect(mention).toBeVisible();
		await mention.hover();
		const card = page.locator('[data-hint-popup] [data-card-hint]').first();
		await expect(card).toBeVisible();
		const box = (await card.boundingBox())!;
		expect(box.height).toBeGreaterThan(viewport.height * 0.25);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
		expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

		// Тап мимо — по «стене» под прикреплённой подсказкой — закрывает всё.
		await page.locator('[data-hint-backdrop]').first().click({position: {x: 5, y: 5}});
		await expect(page.locator('[data-hint-popup] .actionHint')).toHaveCount(0);
	});

	test('в стеке не больше карточек, чем живых игроков, свежая — справа', async () => {
		// Полный обмен: сброс, предложение, ответная карта, переход хода — строк
		// лога после него заведомо больше, чем игроков за столом.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['analysis', 'suspicion', 'tenacity', 'barricade', 'whiskey'],
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
			deck: ['analysis', 'analysis', 'analysis'],
		});
		await session.discard('Alice', 'analysis');
		await session.offerTrade('Alice', 'suspicion');
		await session.offerTrade('Bob', 'fear');
		await session.waitFor('Alice', (s) => s.gameLog.length > NICKS.length);

		const page = session.page('Alice');
		await clearNotifications(page);
		const slots = page.locator('.actionSlot:not(.isLeaving)');
		// Лишние строки стек выбил: карточек ровно на круг стола.
		await expect(slots).toHaveCount(NICKS.length);

		// Свежая карточка — самая правая и подсвеченная.
		const latest = page.locator('.actionSlot.isLatest');
		await expect(latest).toHaveCount(1);
		const latestBox = (await latest.boundingBox())!;
		const boxes = await slots.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().left));
		expect(latestBox.x).toBe(Math.max(...boxes));
	});
});
