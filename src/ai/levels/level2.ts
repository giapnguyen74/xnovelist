import { LevelModule } from '../types';
import { fixGrammar } from '../actions/fixGrammar';
import { rephrase } from '../actions/rephrase';
import { shorten } from '../actions/shorten';
import { polishDialogue } from '../actions/polishDialogue';
import { vividDetail } from '../actions/vividDetail';

export const LEVEL_2: LevelModule = {
  level: 2,
  label: 'Editor',
  blurb: 'AI edits text you select — rephrase, fix grammar, shorten, polish dialogue. It never starts a sentence.',
  actions: [
    fixGrammar,
    rephrase,
    shorten,
    polishDialogue,
    vividDetail,
  ],
};
