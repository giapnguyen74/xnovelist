// Deprecated location. The canonical action registry lives in `src/ai/registry.ts`
// (assembled from the level modules with load-time level/duplicate checks).
// Re-exported here only so any stale import keeps resolving to the single source.
export { ALL_ACTIONS, findAction, actionsForLevel, levelsForUI, LEVELS } from '../registry';
