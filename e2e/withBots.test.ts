import {test, expect, Browser, Page} from '@playwright/test';

// Dev mode `?withBots=true`: a human creates a game and immediately plays against
// server-driven bots (five by default, 1s pacing). Optional `&seed=`,
// `&firstPanic=`, `&hand=`, `&botCount=` rig the game for convenient manual
// testing. All over the real client/socket/engine in the browser.

interface GcWindow {
	__nechto?: {
		currentPlayerId: string | null;
		hand: Record<string, {id: string; uniqueId: string}>;
		players: Record<string, {id: string; nickname: string; turnState: string}>;
		playersList: string[];
		gameLog: {text: string; type: string}[];
		currentAction: {type: string; menu?: {action: string}[]; playersToSelect?: string[]; cards?: Record<string, {uniqueId: string}>} | null;
		notifications: {type: string; text?: string}[];
		handActions: Record<string, {menuType: string}[]>;
		cardAction(actionType: string, cardUniqueId: string): void;
		selectPlayer(id: string): void;
		actionDecision(a: string): void;
		cardPick(): void;
	};
}

// Ждём ровно тех игроков, которых заказали в query: человек + botCount ботов
// (по умолчанию пять).
const expectedPlayers = (query: string): number => {
	const requested = new URLSearchParams(query.replace(/^\?/, '')).get('botCount');
	const botCount = requested === null || Number.isNaN(Number(requested)) ? 5 : Number(requested);
	return Math.min(11, Math.max(3, Math.floor(botCount))) + 1;
};

async function createBotGame(browser: Browser, query: string, nick = 'Me'): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`/${query}`);
	await expect(page.getByRole('heading', {name: 'Вход'})).toBeVisible();
	await page.getByPlaceholder('введи ник').fill(nick);
	await page.getByRole('button', {name: 'Создай игру'}).click();
	await expect(page.locator('canvas')).toBeVisible({timeout: 20_000});
	const total = expectedPlayers(query);
	await page.waitForFunction(
		(count) => {
			const gc = (window as unknown as GcWindow).__nechto;
			return !!gc && gc.playersList.length === count;
		},
		total,
	);
	return page;
}

interface BotSnap {
	currentPlayerId: string | null;
	hand: Record<string, {id: string; uniqueId: string}>;
	players: Record<string, {id: string; nickname: string; turnState: string}>;
	playersList: string[];
	gameLog: string[];
	currentAction: {type: string} | null;
	notifications: {type: string; text?: string}[];
}

const snap = (page: Page): Promise<BotSnap> =>
	page.evaluate(() => {
		const gc = (window as unknown as GcWindow).__nechto!;
		return JSON.parse(JSON.stringify({
			currentPlayerId: gc.currentPlayerId,
			hand: gc.hand,
			players: gc.players,
			playersList: gc.playersList,
			gameLog: gc.gameLog.map((entry) => entry.text),
			currentAction: gc.currentAction,
			notifications: gc.notifications,
		}));
	}) as Promise<BotSnap>;

test.describe('Игра с ботами (?withBots=true)', () => {
	test('создаёт игру с 5 ботами, сид в логе, ход у человека', async ({browser}: {browser: Browser}) => {
		const page = await createBotGame(browser, '?withBots=true&seed=777');
		try {
			const s = await snap(page);
			const nicks = Object.values(s.players).map((p) => p.nickname).sort();
			expect(nicks).toEqual(['Me', 'Бот 1', 'Бот 2', 'Бот 3', 'Бот 4', 'Бот 5'].sort());
			// Сид записан первой строкой игрового лога.
			expect(s.gameLog[0]).toBe('Сид игры: 777');
			// Человек ходит первым.
			const me = Object.values(s.players).find((p) => p.nickname === 'Me')!;
			expect(s.currentPlayerId).toBe(me.id);
			expect(me.turnState).toBe('inCardPick');
		} finally {
			await page.context().close();
		}
	});

	test('&botCount=... задаёт число ботов за столом', async ({browser}: {browser: Browser}) => {
		const page = await createBotGame(browser, '?withBots=true&seed=777&botCount=8');
		try {
			const s = await snap(page);
			const nicks = Object.values(s.players).map((p) => p.nickname).sort();
			expect(nicks.length).toBe(9);
			expect(nicks).toContain('Бот 8');
			expect(nicks).toContain('Me');
		} finally {
			await page.context().close();
		}
	});

	test('&botCount= вне диапазона зажимается: 99 → 11 ботов', async ({browser}: {browser: Browser}) => {
		// createBotGame сам ждёт зажатое число игроков — если бы сервер посадил 99
		// ботов, ожидание бы не сошлось.
		const page = await createBotGame(browser, '?withBots=true&seed=777&botCount=99');
		try {
			const s = await snap(page);
			expect(s.playersList.length).toBe(12);
			expect(Object.values(s.players).map((p) => p.nickname)).toContain('Бот 11');
		} finally {
			await page.context().close();
		}
	});

	test('&hand=... подтасовывает руку человека', async ({browser}: {browser: Browser}) => {
		const page = await createBotGame(browser, '?withBots=true&hand=flamethrower-analysis-suspicion-barricade');
		try {
			const s = await snap(page);
			expect(Object.values(s.hand).map((c) => c.id).sort()).toEqual(
				['analysis', 'barricade', 'flamethrower', 'suspicion'].sort(),
			);
		} finally {
			await page.context().close();
		}
	});

	test('&firstPanic=... кладёт панику наверх колоды — человек тянет её первым ходом', async ({browser}: {browser: Browser}) => {
		const page = await createBotGame(browser, '?withBots=true&seed=3&firstPanic=oldRopes');
		try {
			// Человек берёт верхнюю карту — это паника, срабатывает сразу.
			await page.evaluate(() => (window as unknown as GcWindow).__nechto!.cardPick());
			await expect
				.poll(async () => {
					const s = await snap(page);
					return s.gameLog.some((l) => l.includes('достает карту паники'));
				}, {timeout: 10_000})
				.toBe(true);
		} finally {
			await page.context().close();
		}
	});

	test('боты ходят сами после хода человека (с задержкой ~1с)', async ({browser}: {browser: Browser}) => {
		// botCount фиксируем вместе с сидом: раздача зависит от числа игроков, а
		// сценарию нужен именно «взял обычную карту, сбросил, обменялся».
		const page = await createBotGame(browser, '?withBots=true&seed=42&botCount=4');
		try {
			// Человек проходит свой ход: берёт карту, сбрасывает одну, и ход уходит
			// боту.
			await page.evaluate(() => (window as unknown as GcWindow).__nechto!.cardPick());
			await page.waitForFunction(() => {
				const gc = (window as unknown as GcWindow).__nechto!;
				const me = gc.currentPlayerId ? gc.players[gc.currentPlayerId] : undefined;
				return me?.turnState === 'inCardAction';
			});
			// Сбрасываем первую карту с доступным действием cardDiscard.
			await page.evaluate(() => {
				const gc = (window as unknown as GcWindow).__nechto!;
				const entry = Object.entries(gc.handActions).find(([, acts]) => acts.some((a) => a.menuType === 'discard'));
				if (entry) gc.cardAction('discard', entry[0]);
			});

			// Теперь меняемся с ботом, чтобы передать ход дальше.
			await page.waitForFunction(() => {
				const gc = (window as unknown as GcWindow).__nechto!;
				const me = gc.currentPlayerId ? gc.players[gc.currentPlayerId] : undefined;
				return me?.turnState === 'inOffenseTrade';
			});
			const beforeLen = (await snap(page)).gameLog.length;
			await page.evaluate(() => {
				const gc = (window as unknown as GcWindow).__nechto!;
				const entry = Object.entries(gc.handActions).find(([, acts]) => acts.some((a) => a.menuType === 'cardTrade'));
				if (entry) gc.cardAction('cardTrade', entry[0]);
			});

			// С этого момента человек НЕ ходит — игра должна продолжаться сама за
			// счёт ботов: лог растёт.
			await expect
				.poll(async () => (await snap(page)).gameLog.length, {timeout: 15_000})
				.toBeGreaterThan(beforeLen + 2);

			// Ход ушёл ботам — их таймер в заголовок вкладки не лезет.
			await expect(page).toHaveTitle('Me - Нечто', {timeout: 15_000});
		} finally {
			await page.context().close();
		}
	});

	test('на своём ходе в заголовке вкладки тикает таймер', async ({browser}: {browser: Browser}) => {
		const page = await createBotGame(browser, '?withBots=true&seed=777');
		try {
			// Первый ход человека: заголовок = его собственный отсчёт.
			await expect(page).toHaveTitle(/^\d+ сек твой ход Me$/, {timeout: 10_000});
			const first = Number((await page.title()).match(/^(\d+) сек/)?.[1]);
			// И он именно тикает, причём ВНИЗ: в заголовке остаток, а не набежавшее
			// время. Когда остаток дошёл до нуля, цифры уступают место «Твой ход» —
			// это тоже «меньше», отсчёт своё отработал.
			await expect
				.poll(async () => {
					const title = await page.title();
					return Number(title.match(/^(\d+) сек/)?.[1] ?? 0);
				}, {timeout: 10_000})
				.toBeLessThan(first);
		} finally {
			await page.context().close();
		}
	});
});
