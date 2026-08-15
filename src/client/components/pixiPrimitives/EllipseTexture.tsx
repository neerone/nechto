import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * Картинка, вписанная в эллипс: заливка эллипса текстурой, а не спрайт с ней.
 *
 * Спрайт остался бы прямоугольником и торчал бы углами за кружок игрока, а
 * маска в pixi требует держать графику отдельным объектом в дереве и следить за
 * её трансформом. Graphics умеет заливать фигуру текстурой сам — этого хватает.
 *
 * Картинка вписывается «по большей стороне»: заполняет эллипс целиком, лишнее
 * уходит за край. Так она не растягивается под чужие пропорции.
 *
 * focus выбирает, какой её кусок должен попасть в кадр: у карты это не вся
 * карта с заголовком и текстом, а только сама иллюстрация. Кадрируем матрицей
 * заливки, а не отдельной текстурой с frame: та требует загруженной картинки в
 * момент создания и падает, если кадр не влез в ещё не известный ей размер.
 */

interface IFocus {
	// Кусок картинки, который надо показать, — в долях её размеров.
	x: number;
	y: number;
	width: number;
	height: number;
}

interface EllipseTextureProps {
	rx: number;
	ry: number;
	texture: PIXI.Texture;
	focus?: IFocus;
	alpha?: number;
	// Растянуть картинку под эллипс, а не вписать её «по большей стороне». Так
	// рисуется столешница: это круг, увиденный из-за края стола, и его рисунок
	// обязан сжаться вместе с ним (см. tableSquash), а не поехать краями за него.
	stretch?: boolean;
	// Отразить картинку по горизонтали. Зеркалим саму заливку, а не объект:
	// объект пришлось бы разворачивать вместе со всем, что на нём лежит, а
	// отражать надо ровно рисунок. Так столешница переворачивает нарисованные на
	// ней стрелки хода (см. TableSurface): у зеркального круга направление
	// вращения меняется на противоположное.
	flipX?: boolean;
}

const wholeTexture: IFocus = {x: 0, y: 0, width: 1, height: 1};

const TYPE = "EllipseTexture";
export const behavior = {
	customDisplayObject: (_props: EllipseTextureProps) => new PIXI.Graphics(),
	customApplyProps: function(
		this: GraphicsBehaviorThis<EllipseTextureProps>,
		instance: PIXI.Graphics,
		oldProps: EllipseTextureProps | undefined,
		newProps: EllipseTextureProps,
	) {
		const { rx, ry, texture, focus = wholeTexture, stretch = false, flipX = false } = newProps;
		// Заливка текстурой заново собирает геометрию, а карты статусов висят на
		// кружках всё время партии: пока размер и картинка те же, перерисовывать
		// нечего (стол пересчитывается на любое обновление).
		const oldFocus = oldProps && (oldProps.focus ?? wholeTexture);
		if (oldProps
			&& oldProps.rx === rx && oldProps.ry === ry && oldProps.texture === texture
			&& oldFocus === focus && (oldProps.stretch ?? false) === stretch
			&& (oldProps.flipX ?? false) === flipX) {
			this.applyDisplayObjectProps(oldProps, newProps);
			return;
		}
		if (typeof oldProps !== "undefined") {
			instance.clear();
		}
		// Пока картинка не догрузилась, её размеры — нули: заливать по ним нечего,
		// а перерисуется бейдж и без того (стол пересчитывает его на каждом ходе).
		const width = Math.max(1, texture.width);
		const height = Math.max(1, texture.height);
		// Масштаб — по кадру, а не по всей картинке: в эллипс должен влезть именно он.
		// По каждой оси свой, если картинку растягиваем, и общий (по большей
		// стороне), если вписываем: тогда она заполняет эллипс, не перекашиваясь.
		const byWidth = (rx * 2) / (width * focus.width);
		const byHeight = (ry * 2) / (height * focus.height);
		// Отражение — это отрицательный масштаб по X; сдвиг считается от него же,
		// поэтому середина кадра остаётся в середине эллипса и у зеркальной заливки.
		const scaleX = (stretch ? byWidth : Math.max(byWidth, byHeight)) * (flipX ? -1 : 1);
		const scaleY = stretch ? byHeight : Math.max(byWidth, byHeight);
		// И сдвиг такой, чтобы середина кадра пришлась на середину эллипса.
		const matrix = new PIXI.Matrix()
			.scale(scaleX, scaleY)
			.translate(
				-(focus.x + focus.width / 2) * width * scaleX,
				-(focus.y + focus.height / 2) * height * scaleY,
			);

		instance.beginTextureFill({ texture, matrix });
		instance.drawEllipse(0, 0, Math.max(0, rx), Math.max(0, ry));
		instance.endFill();

		this.applyDisplayObjectProps(oldProps, newProps);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
