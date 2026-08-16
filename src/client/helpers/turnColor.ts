/**
 * Цвет метки хода — по тому, сколько кругов уже намотала её стрелка (см.
 * TurnReticle).
 *
 * Считаем кругами, а не секундами, и в этом весь смысл: круг — это то, что видно
 * глазом, и каждый следующий обязан отличаться от предыдущего. По секундам цвет
 * приходилось привязывать к длине круга на глазок, и стрелка успевала намотать
 * пять оборотов, оставаясь всё тем же зелёным.
 *
 * За круг тон уходит на lapHueStep — этого хватает, чтобы разница читалась
 * сразу, но мало для мельтешения: внутри одного круга шлейф остаётся почти
 * одноцветным. Красным (то есть третьим кругом) метка становится примерно к
 * тридцатой секунде — это самый долгий из отпущенных сроков, дольше стол не
 * ждёт никого.
 *
 * Дальше тон идёт по кругу и никуда не упирается — малиновый, фиолетовый,
 * синий и обратно к зелёному. Так и надо: время за столом не «кончается»,
 * отпущенные секунды выходят, а сервер всё равно ждёт (см. server/models/Player),
 * и цвет должен показывать, что время идёт, а не замереть на упоре.
 */
const startHue = 120;
const lapHueStep = 40;

/**
 * HSL → 0xRRGGBB. Тон здесь — величина со смыслом (сколько времени прошло), и
 * вести его удобно одним числом, а не тремя каналами.
 */
const hslColor = (hue: number, saturation: number, lightness: number): number => {
	const sector = ((((hue % 360) + 360) % 360) / 60);
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const second = chroma * (1 - Math.abs((sector % 2) - 1));
	const rgb: [number, number, number] = sector < 1 ? [chroma, second, 0]
		: sector < 2 ? [second, chroma, 0]
		: sector < 3 ? [0, chroma, second]
		: sector < 4 ? [0, second, chroma]
		: sector < 5 ? [second, 0, chroma]
		: [chroma, 0, second];
	const [red, green, blue] = rgb;
	const base = lightness - chroma / 2;
	const byte = (value: number) => {
		const level = Math.round((value + base) * 255);
		return level < 0 ? 0 : level > 255 ? 255 : level;
	};
	return (byte(red) << 16) | (byte(green) << 8) | byte(blue);
};

// На нулевом круге это ровно тот зелёный, каким метка хода была до всяких часов,
// — 0x00FF00.
export const turnTimerColor = (laps: number): number => hslColor(startHue - lapHueStep * laps, 1, 0.5);
