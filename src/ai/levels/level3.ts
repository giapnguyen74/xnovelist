import { LevelModule } from '../types';
import { writeBeat } from '../actions/writeBeat';
import { continueBeat } from '../actions/continueBeat';

export const LEVEL_3: LevelModule = {
  level: 3,
  label: 'Co-writer',
  blurb: 'AI writes beats and scenes with you.',
  actions: [writeBeat, continueBeat],
};

