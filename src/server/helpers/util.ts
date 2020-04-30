import {uniqueId, each} from 'lodash';

export function shuffle<T extends any[]>(array: T): T {

  if (array.length === 0 || array.length === 1) return array

  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

const silent = true;
export let debugCache = [];
export function clearDebugCache() {
  debugCache = [];
}
export function printDebugCache() {
  each(debugCache, log => {console.log(...log)})
}
export function debugLog(...log) {
  debugCache.push([...log]);
  if (!silent) {
    console.log(...log)
  }
}
