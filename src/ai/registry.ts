import { LevelModule, Action } from './types';
import { LEVEL_1 } from './levels/level1';
import { LEVEL_2 } from './levels/level2';
import { LEVEL_3 } from './levels/level3';
import { LEVEL_4 } from './levels/level4';
import { LEVEL_5 } from './levels/level5';

export const LEVELS: readonly LevelModule[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];

/**
 * Flat, frozen action list. A level module may only contribute actions whose own
 * `level` matches the module's level — a mismatch fails fast at load time.
 */
export const ALL_ACTIONS: readonly Action[] = Object.freeze(
  LEVELS.flatMap((m) =>
    m.actions.map((a) => {
      if (a.level !== m.level) {
        throw new Error(`Action "${a.id}" is in level ${m.level} module but tagged level ${a.level}.`);
      }
      return a;
    })
  )
);

const idDupes = ALL_ACTIONS.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
if (idDupes.length) {
  throw new Error(`Duplicate action id(s): ${idDupes.join(', ')}`);
}

export function findAction(id: string): Action | undefined {
  return ALL_ACTIONS.find((a) => a.id === id);
}

/** Every action whose level is at or below the workspace level. Empty at level 0. */
export function actionsForLevel(level: number): Action[] {
  return ALL_ACTIONS.filter((a) => a.level <= level);
}

/** Level modules with their actions filtered to the active workspace level. */
export function levelsForUI(level: number): Array<LevelModule & { unlocked: boolean }> {
  return LEVELS.map((m) => ({ ...m, unlocked: m.level <= level }));
}
