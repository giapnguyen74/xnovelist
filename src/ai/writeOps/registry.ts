import { WriteOp } from '../types';
import { characterAdd } from './characterAdd';
import { characterUpdate } from './characterUpdate';
import { locationAdd } from './locationAdd';
import { locationUpdate } from './locationUpdate';
import { styleSet } from './styleSet';
import { appendContinuity } from './appendContinuity';
import { continuitySet } from './continuitySet';
import { replaceRangeOp } from './replaceRange';

export const ALL_WRITE_OPS: readonly WriteOp[] = Object.freeze([
  characterAdd,
  characterUpdate,
  locationAdd,
  locationUpdate,
  styleSet,
  appendContinuity,
  continuitySet,
  replaceRangeOp,
]);

export function findWriteOp(id: string): WriteOp | undefined {
  return ALL_WRITE_OPS.find((op) => op.id === id);
}

