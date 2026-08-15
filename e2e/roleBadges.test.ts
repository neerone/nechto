import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from './helpers/nechto';

// Кто как выглядит на столе. Роль показывается самим бейджем игрока (нечто —
// его морда, заражённый — щупальца с карты «Заражения»), поэтому важно ровно одно:
// какие роли сервер вообще присылает конкретному зрителю. Чистый не должен
// узнать ничего, заражённый — только нечто (оно же его и заразило, больше
// заражать некому), нечто — всех своих.
//
// Сам бейдж выбирается в PlayerBadge по этим же полям (getBadgeResource),
// холст проверить нечем — проверяем данные, из которых он выбирается.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Бейджи ролей: кто кого видит', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('чистый игрок не видит ни нечто, ни заражённых', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Carol',
			things: ['Alice'],
			infected: ['Bob'],
			hands: {Carol: ['analysis', 'suspicion', 'barricade', 'whiskey']},
		});

		const carol = await session.snapshot('Carol');
		for (const nick of NICKS) {
			const player = carol.players[await session.idOf(nick)];
			expect(player?.isThing, `${nick} глазами чистой Carol`).toBeNull();
			// Про себя игрок знает, что он чист; про остальных — ничего.
			expect(player?.isInfected).toBe(nick === 'Carol' ? false : null);
		}
	});

	test('нечто видит себя и всех заражённых', async () => {
		const alice = await session.snapshot('Alice');
		const thing = alice.players[await session.idOf('Alice')];
		const bob = alice.players[await session.idOf('Bob')];
		const dave = alice.players[await session.idOf('Dave')];

		expect(thing?.isThing).toBe(true);
		expect(bob?.isThing).toBe(false);
		expect(bob?.isInfected).toBe(true);
		expect(dave?.isInfected).toBe(false);
	});

	test('заражённый видит нечто — того, кто его заразил', async () => {
		const bob = await session.snapshot('Bob');
		const aliceSeen = bob.players[await session.idOf('Alice')];
		const bobSeen = bob.players[bob.currentPlayerId!];

		expect(aliceSeen?.isThing).toBe(true);
		expect(bobSeen?.isInfected).toBe(true);
	});

	test('заражённый не видит других заражённых', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Carol',
			things: ['Alice'],
			infected: ['Bob', 'Dave'],
			hands: {Carol: ['analysis', 'suspicion', 'barricade', 'whiskey']},
		});

		const bob = await session.snapshot('Bob');
		const daveSeen = bob.players[await session.idOf('Dave')];
		expect(daveSeen?.isInfected).toBeNull();
		expect(daveSeen?.isThing).toBe(false);
	});

	test('после реального заражения жертва сразу видит нечто', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			things: ['Alice'],
			hands: {
				Alice: ['infect', 'analysis', 'suspicion', 'barricade', 'whiskey'],
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
		});

		const aliceId = await session.idOf('Alice');
		// До заражения Bob чист и роли Alice не знает.
		const before = await session.snapshot('Bob');
		expect(before.players[aliceId]?.isThing).toBeNull();

		await session.discard('Alice', 'analysis');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'infect');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.offerTrade('Bob', 'fear');

		await session.waitFor('Bob', (s) => s.players[aliceId]?.isThing === true);
		const bob = await session.snapshot('Bob');
		expect(bob.players[bob.currentPlayerId!]?.isInfected).toBe(true);

		// Остальные игроки по-прежнему не видят ничего.
		const carol = await session.snapshot('Carol');
		expect(carol.players[aliceId]?.isThing).toBeNull();
		expect(carol.players[await session.idOf('Bob')]?.isInfected).toBeNull();
	});
});
