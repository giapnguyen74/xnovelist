import { Action } from '../types';
import { captureCharacters } from './captureCharacters';
import { captureLocations } from './captureLocations';
import { captureStyle } from './captureStyle';
import { summarizeChapter } from './summarizeChapter';
import { checkContinuity } from './checkContinuity';

export const ALL_ACTIONS: readonly Action[] = Object.freeze([
  captureCharacters,
  captureLocations,
  captureStyle,
  summarizeChapter,
  checkContinuity,
]);

export function findAction(id: string): Action | undefined {
  return ALL_ACTIONS.find((act) => act.id === id);
}
