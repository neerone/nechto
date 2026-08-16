/**
 * Переносит готовые записи из sounds-raw в ассеты клиента.
 *
 * Копированием вручную это делать нельзя ровно по одной причине: в mp3 из
 * стоков лежит ID3 с обложкой, и она бывает больше самого звука — у дробовика
 * это 8.9 КБ метаданных на 11.8 КБ звука. Игре обложка не нужна, а в бандл она
 * попадает целиком. Здесь она срезается, и заодно видно, что за звук приехал:
 * длину и формат скрипт считает по кадрам.
 *
 * Всё остальное с записями не делаем — их взяли готовыми и такими же хотят
 * слышать. Если запись нужно резать (как молоток), это отдельный скрипт со
 * своим разбором — см. cutBarricadeSound.
 *
 *     bun run scripts/importRawSounds.ts
 */
import {join} from 'path';

const ROOT = join(import.meta.dir, '..');
const RAW = join(ROOT, 'sounds-raw');
const SOUND = join(ROOT, 'src/client/resources/sound');

const imports: {from: string; to: string}[] = [
	{from: 'shotgun-pump-action_mkv5cgv_.mp3', to: 'tenacity.mp3'},
	{from: 'hmm.mp3', to: 'suspicion.mp3'},
	// Анализа здесь нет: его запись слишком тихая для стола, и усиливает её
	// отдельный скрипт — см. amplifyRawSounds.
	{from: 'opening-a-bottle-of-wine.mp3', to: 'whiskey.mp3'},
	// Один отказ на три защитные карты: «Нет уж, спасибо!», «Страх» и «Мимо!» — в
	// игре это одно и то же движение, отбиться от чужой карты.
	{from: 'negative.mp3', to: 'negative.mp3'},
	{from: 'axe-hit.mp3', to: 'axe.mp3'},
	// Карантина здесь нет: оба его звука (как вешают и как спадает) собираются из
	// нескольких записей разом — цепи, замок, отмычка, — и этим занят свой скрипт,
	// см. cutQuarantineSounds. Раньше на карантине стояла zipper.mp3, застёгнутая
	// молния: звук был про герметичный костюм, а на столе игрока запирают в цепи.
	{from: 'girl.mp3', to: 'seduction.mp3'},
	// Один звук на «Меняемся местами!» и «Сматывай удочки!»: обе карты делают за
	// столом одно и то же — пересаживают игроков.
	{from: 'move.mp3', to: 'move.mp3'},
	// Шелест бумаги: им звучит любое движение карты — и обмен между игроками, и
	// взятие из колоды.
	{from: 'paper.mp3', to: 'paper.mp3'},
	// Паника здесь не значится: у её записи с четвёртой секунды и до конца тянется
	// шумовая полка, и режет её отдельный скрипт — см. cutPanicSound.
	{from: 'throw-paper.mp3', to: 'discard.mp3'},
	// Развязка партии: чей верх, тот и звучит.
	{from: 'evil-laugh.mp3', to: 'thingWin.mp3'},
	{from: 'joy-yell.mp3', to: 'thingLose.mp3'},
	// «Гляди по сторонам» звучит двумя записями разом: гром — как удар события,
	// разворот — как само действие карты (она разворачивает ход стола). Сводить их
	// в один файл незачем, клиент играет обе (см. playLookaround).
	{from: 'grom.mp3', to: 'lookaroundThunder.mp3'},
	{from: 'razvorot.mp3', to: 'lookaroundTurn.mp3'},
];

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const RATES = [44100, 48000, 32000, 0];
const CHANNEL_MODE = ['стерео', 'joint stereo', 'два канала', 'моно'];

/** Где в файле начинается звук: за ID3v2 (в нём и живёт обложка). */
const audioStart = (bytes: Uint8Array): number => {
	if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
	// Размер тега — семибитными группами (старший бит каждого байта не в счёт).
	const size = ((bytes[6] ?? 0) & 0x7f) << 21 | ((bytes[7] ?? 0) & 0x7f) << 14
		| ((bytes[8] ?? 0) & 0x7f) << 7 | ((bytes[9] ?? 0) & 0x7f);
	return 10 + size;
};

/** Где звук кончается: перед ID3v1, если он есть (128 байт с меткой TAG). */
const audioEnd = (bytes: Uint8Array): number => {
	const from = bytes.length - 128;
	if (from < 0) return bytes.length;
	if (bytes[from] === 0x54 && bytes[from + 1] === 0x41 && bytes[from + 2] === 0x47) return from;
	return bytes.length;
};

/** Длина и формат — по заголовкам кадров MPEG-1 Layer III. */
const describe = (audio: Uint8Array): string => {
	let offset = 0;
	let frames = 0;
	let rate = 0;
	let bitrate = 0;
	let mode = '';
	while (offset < audio.length - 4) {
		const [b0, b1, b2, b3] = [audio[offset], audio[offset + 1], audio[offset + 2], audio[offset + 3]];
		if (b0 === 0xff && b1 !== undefined && (b1 & 0xe0) === 0xe0 && b2 !== undefined && b3 !== undefined) {
			const version = (b1 >> 3) & 3;
			const layer = (b1 >> 1) & 3;
			const kbps = BITRATES[(b2 >> 4) & 15] ?? 0;
			const hz = RATES[(b2 >> 2) & 3] ?? 0;
			// 3 — MPEG-1, 1 — Layer III. Прочее в наших файлах не встречается, и
			// гадать по нему длину не стоит.
			if (version === 3 && layer === 1 && kbps && hz) {
				rate = hz;
				bitrate = kbps;
				mode = CHANNEL_MODE[(b3 >> 6) & 3] ?? '';
				frames++;
				offset += Math.floor(144000 * kbps / hz) + ((b2 >> 1) & 1);
				continue;
			}
		}
		offset++;
	}
	if (!frames || !rate) return 'кадров не нашлось — это не MPEG-1 Layer III?';
	return `${(frames * 1152 / rate).toFixed(2)} с, ${rate} Гц, ${mode}, ${bitrate} кбит/с`;
};

for (const {from, to} of imports) {
	const bytes = new Uint8Array(await Bun.file(join(RAW, from)).arrayBuffer());
	const audio = bytes.subarray(audioStart(bytes), audioEnd(bytes));
	await Bun.write(join(SOUND, to), audio);
	const dropped = bytes.length - audio.length;
	console.log(`${from} -> ${to}: ${describe(audio)}, ${(audio.length / 1024).toFixed(1)} КБ`
		+ (dropped ? ` (срезано метаданных: ${(dropped / 1024).toFixed(1)} КБ)` : ''));
}
