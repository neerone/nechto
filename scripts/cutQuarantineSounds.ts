/**
 * Собирает два звука карантина из живых записей: как его вешают и как он спадает.
 *
 *   quarantine.mp3      — звон цепей, а следом щелчок запертого замка;
 *   quarantineOver.mp3  — отмычка ковыряет личинку, дужка отскакивает, цепи
 *                         сползают.
 *
 * Раньше карантин звучал застёгнутой молнией (zipper.mp3): звук был про
 * герметичный костюм, а на столе игрока не упаковывают, а запирают — по кружку
 * ползут цепи с замками (см. QuarantineSkin). Синтезом это тоже пробовали, и
 * вышло то же, что когда-то с молотком (см. cutBarricadeSound): набор затухающих
 * синусов звучит железкой, но не цепью — у настоящей записи звенья бьют друг о
 * друга так, как расписанием не задать.
 *
 * Источники лежат в sounds-raw и взяты с freesound.org, все под CC0 (общественное
 * достояние, никаких условий по использованию):
 *
 *   chains.mp3         freesound.org/s/348974  (freemaster2, «Chains 2» —
 *                      цепи, которые тянут, записано в помещении);
 *   padlock-close.mp3  freesound.org/s/531519  (Melilaura, «padlock»);
 *   padlock-open.mp3   freesound.org/s/536414  (Rudmer_Rotteveel,
 *                      «Small Padlock Opening»);
 *   lockpicking.mp3    freesound.org/s/595660  (SavReese, «Lock being picked»);
 *                      в sounds-raw лежит кусок оригинала с 28-й секунды — весь
 *                      он длиной три четверти минуты, и хранить его целиком ради
 *                      секунды звука незачем.
 *
 * Моменты срезов подобраны по этим записям и записаны здесь числами: искать их
 * по огибающей, как у молотка, тут нечем — в цепях каждый удар «начало удара», и
 * порогом из них нужный кусок не выбрать.
 *
 * Пересобрать (mp3 лежат под гитом):
 *
 *     bun run scripts/cutQuarantineSounds.ts
 */
import {MPEGDecoder} from 'mpg123-decoder';
import {join} from 'path';
import {writeMp3} from './soundKit';

const ROOT = join(import.meta.dir, '..');
const RAW = join(ROOT, 'sounds-raw');
const SOUND = join(ROOT, 'src/client/resources/sound');

const RATE = 44100;
const BITRATE = 112;
// Нормируем с запасом до потолка: перед mp3 он нужен, иначе кодек выдаёт пики
// выше единицы и они щёлкают.
const PEAK = 0.92;

/** Кусок записи, положенный в сборку. */
interface ILayer {
	// Файл в sounds-raw.
	from: string;
	// Что берём из записи и куда кладём в собираемом звуке, в секундах.
	cutFrom: number;
	cutTo: number;
	at: number;
	// Во сколько раз громче оригинала. Записи сведены по-разному, и у тихих (та же
	// отмычка — она записана почти на пределе слышимости) это не «погромче», а
	// единственный способ вообще попасть в один звук с цепями.
	gain: number;
	// Края обязаны сойтись в ноль: срез посреди звука слышен щелчком, а щелчок в
	// звуке про щелчок замка — последнее, что нужно.
	fadeIn: number;
	fadeOut: number;
}

interface ISound {
	out: string;
	title: string;
	duration: number;
	layers: ILayer[];
}

const sounds: ISound[] = [
	{
		out: 'quarantine.mp3',
		title: 'Quarantine',
		duration: 1.4,
		layers: [
			// Цепи. Кусок начинается ровно с рывка (7.64 с в записи) и идёт, пока
			// звенья бьются друг о друга; обрывается там, где в записи их
			// перехватывают руками — дальше слышно уже человека, а не цепь.
			{from: 'chains.mp3', cutFrom: 7.62, cutTo: 8.56, at: 0, gain: 1, fadeIn: 0.004, fadeOut: 0.1},
			// Щелчок. Кладётся впритык к затихающим цепям, а не после паузы: пауза
			// разваливает звук на два — сначала что-то звенело, потом где-то щёлкнуло.
			{from: 'padlock-close.mp3', cutFrom: 4.4, cutTo: 4.78, at: 0.9, gain: 1.15, fadeIn: 0.002, fadeOut: 0.06},
		],
	},
	{
		out: 'quarantineOver.mp3',
		title: 'Quarantine over',
		duration: 1.9,
		layers: [
			// Отмычка: щелчки по штифтам. В записи их пять на четыре секунды — их и
			// берём, но каждый отдельным куском и вплотную друг к другу: вскрытие
			// должно слышаться работой, а не редким постукиванием.
			//
			// Запись очень тихая (пики в сотые доли), поэтому усиления большие — и
			// у каждого щелчка своё: сняты они с разной силой, и без выравнивания
			// один пробивается, а трёх остальных нет вовсе. Вместе с усилением
			// поднимается и шум записи, но за отскоком и цепями его не слышно.
			//
			// Последний щелчок самый заметный: на нём штифт встаёт, и следом
			// проворачивается личинка.
			{from: 'lockpicking.mp3', cutFrom: 0.8, cutTo: 0.92, at: 0, gain: 10, fadeIn: 0.005, fadeOut: 0.03},
			{from: 'lockpicking.mp3', cutFrom: 1.48, cutTo: 1.68, at: 0.16, gain: 10, fadeIn: 0.005, fadeOut: 0.03},
			{from: 'lockpicking.mp3', cutFrom: 2.34, cutTo: 2.5, at: 0.42, gain: 9, fadeIn: 0.005, fadeOut: 0.03},
			{from: 'lockpicking.mp3', cutFrom: 3.64, cutTo: 3.8, at: 0.62, gain: 6, fadeIn: 0.005, fadeOut: 0.03},
			// Дужка отскочила: заперто больше не заперто.
			{from: 'padlock-open.mp3', cutFrom: 0.012, cutTo: 0.14, at: 0.85, gain: 1.3, fadeIn: 0.002, fadeOut: 0.04},
			// И цепи сползают — тот же моток, но там, где его не тянут, а отпускают:
			// звон идёт на убыль сам, и последнее, что слышно, — как он затихает.
			// Тише отмычки и отскока: цепи здесь уже не событие, а его последствие.
			{from: 'chains.mp3', cutFrom: 8.95, cutTo: 9.85, at: 0.89, gain: 2.2, fadeIn: 0.02, fadeOut: 0.3},
		],
	},
];

/** Декодирует mp3 в моно: играем мы моно, а стерео тут только удваивает вес. */
const readMp3 = async (path: string): Promise<Float32Array> => {
	const decoder = new MPEGDecoder();
	await decoder.ready;
	const {channelData, samplesDecoded, sampleRate, errors} = decoder.decode(
		new Uint8Array(await Bun.file(path).arrayBuffer()),
	);
	decoder.free();
	if (errors.length) console.warn(`${path}: декодер ругнулся ${errors.length} раз(а)`);
	if (!samplesDecoded) throw new Error(`${path}: не декодировался`);
	if (sampleRate !== RATE) throw new Error(`${path}: ${sampleRate} Гц, а сборка идёт на ${RATE}`);
	const left = channelData[0];
	if (!left) throw new Error(`${path}: нет каналов`);
	const right = channelData[1];
	if (!right) return left.subarray(0, samplesDecoded);
	const mono = new Float32Array(samplesDecoded);
	for (let i = 0; i < samplesDecoded; i++) mono[i] = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
	return mono;
};

const cache = new Map<string, Float32Array>();
const source = async (name: string): Promise<Float32Array> => {
	const known = cache.get(name);
	if (known) return known;
	const decoded = await readMp3(join(RAW, name));
	cache.set(name, decoded);
	console.log(`  ${name}: ${(decoded.length / RATE).toFixed(2)} с`);
	return decoded;
};

for (const {out, title, duration, layers} of sounds) {
	console.log(`${out}:`);
	const mix = new Float32Array(Math.round(duration * RATE));
	for (const layer of layers) {
		const samples = await source(layer.from);
		const from = Math.round(layer.cutFrom * RATE);
		const to = Math.min(samples.length, Math.round(layer.cutTo * RATE));
		const at = Math.round(layer.at * RATE);
		const fadeIn = Math.max(1, Math.round(layer.fadeIn * RATE));
		const fadeOut = Math.max(1, Math.round(layer.fadeOut * RATE));
		const length = to - from;
		if (length <= 0) throw new Error(`${layer.from}: пустой кусок ${layer.cutFrom}–${layer.cutTo}`);
		if (at + length > mix.length) {
			throw new Error(`${layer.from}: кусок не влезает — ${((at + length) / RATE).toFixed(2)} с при длине ${duration} с`);
		}
		for (let i = 0; i < length; i++) {
			const fade = Math.min(1, i / fadeIn, (length - i) / fadeOut);
			mix[at + i] = (mix[at + i] ?? 0) + (samples[from + i] ?? 0) * layer.gain * fade;
		}
	}

	let peak = 0;
	mix.forEach(value => {
		peak = Math.max(peak, Math.abs(value));
	});
	const gain = peak > 0 ? PEAK / peak : 1;
	const pcm = new Int16Array(mix.length);
	mix.forEach((value, i) => {
		pcm[i] = Math.round(Math.max(-1, Math.min(1, value * gain)) * 32767);
	});

	const bytes = await writeMp3(join(SOUND, out), pcm, BITRATE, RATE);
	console.log(`${title} sound -> ${out} (${duration.toFixed(2)}s, ${(bytes / 1024).toFixed(1)} KB,`
		+ ` нормировка ${gain.toFixed(2)}x)`);
}
