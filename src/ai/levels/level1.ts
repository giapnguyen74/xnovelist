import { LevelModule } from '../types';
import { captureCharacters } from '../actions/captureCharacters';
import { captureLocations } from '../actions/captureLocations';
import { captureStyle } from '../actions/captureStyle';
import { summarizeChapter } from '../actions/summarizeChapter';
import { checkContinuity } from '../actions/checkContinuity';

export const LEVEL_1: LevelModule = {
  level: 1,
  label: 'Reader',
  blurb: 'AI reads your book — captures bible entries, summarizes, checks continuity. It never writes prose.',
  actions: [captureCharacters, captureLocations, captureStyle, summarizeChapter, checkContinuity],
};
