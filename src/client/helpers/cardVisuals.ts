import {resources} from 'client/resources/resources';
import {EEventID, EPanicID} from 'shared/enum/cards';

// Цвет карты: им красится стрелка действия на столе и подложка значка под
// применённой картой. За основу взят доминирующий цвет самого арта (снят с
// центральной части картинки), но арты этой колоды почти одноцветные по
// семействам — события золотисто-сепийные, паники малиновые, карты отказа
// синие, — поэтому внутри семейства оттенки разведены, иначе стрелки было бы
// не отличить одну от другой.
const cardColors: Record<string, number> = {
	// Атакующие события: тёплая часть круга, от огня к зелени.
	[EEventID.flamethrower]: 0xff4d1a,
	[EEventID.axe]: 0xe03535,
	[EEventID.quarantine]: 0xff8c1a,
	[EEventID.seduction]: 0xe08a2e,
	[EEventID.barricade]: 0xc9873a,
	[EEventID.whiskey]: 0xd9a441,
	[EEventID.tenacity]: 0xd9b46a,
	[EEventID.suspicion]: 0xe2c536,
	[EEventID.analysis]: 0xd8e04a,
	[EEventID.lookaround]: 0xf1db1a,
	[EEventID.positionswap]: 0xb6e034,
	[EEventID.reelFishingRods]: 0x4ad98a,
	[EEventID.infect]: 0x9bd42a,
	[EEventID.thing]: 0x8bd130,
	// Карты отказа — синее семейство, как их рамки.
	[EEventID.fear]: 0x3692e2,
	[EEventID.noFire]: 0x18b4ff,
	[EEventID.noThanks]: 0x2fd0d0,
	[EEventID.miss]: 0x5b7bff,
	[EEventID.leaveMeAlone]: 0x7a6cff,
	// Паники — малиновое семейство арта, разведённое по оттенкам.
	[EPanicID.chainReaction]: 0xff2f86,
	[EPanicID.blindDate]: 0xff5fb0,
	[EPanicID.oldRopes]: 0xc22a7a,
	[EPanicID.oneTwo]: 0xe83fa0,
	[EPanicID.threeFour]: 0xb43fd0,
	[EPanicID.onlyBetweenUs]: 0xff77d4,
	[EPanicID.youCallThisParty]: 0xd6247a,
	[EPanicID.goAway]: 0xa02a6e,
	[EPanicID.oops]: 0xff1f6f,
	[EPanicID.friendship]: 0xff8fc4,
	[EPanicID.forgetfulness]: 0x8f2f7a,
	[EPanicID.recognitionTime]: 0xe0308f,
};

// Обмен картами идёт без карты — за него отвечает значок обмена, и цвет у него
// свой, нейтрально-золотой (им же стрелки рисовались до появления палитры).
export const tradeColor = 0xffdf00;

export const cardColor = (cardId: string | undefined): number => {
	if (!cardId) return tradeColor;
	return cardColors[cardId] ?? tradeColor;
};

// resources — объектный литерал, где все карточные записи это string (не-строки
// там только playerBadges, avatars и infectedAvatars, по id карты они никогда не
// ищутся). Смотрим на него через строковый индекс, чтобы достать картинку по
// произвольному id.
const {playerBadges: _playerBadges, avatars: _avatars, infectedAvatars: _infectedAvatars, ...cardImages} = resources;
const cardResources: Record<string, string | undefined> = cardImages;

export const cardImage = (cardId: string | undefined): string | undefined =>
	cardId ? cardResources[cardId] : undefined;
