import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import enDict from '../i18n/ui/en.json';

/** UI translation keys, mirrored from the en pack so steps stay type-checked. */
type TKey = keyof typeof enDict;
type Translate = (key: TKey) => string;

/**
 * Per-page interactive tours. READ-ONLY and NON-INTRUSIVE: a tour only spotlights
 * and explains controls. It never clicks, opens panels, switches tabs, selects
 * text, or edits anything. The single permitted side effect is remembering that a
 * tour has run (`xnovelist-tours-seen`) so it doesn't auto-repeat.
 *
 * v1 covers only the key + AI features per page (works/13-action.md §1b). Extend
 * by adding steps to TOURS and copy keys to the i18n packs — no other changes.
 */

export type TourSurface = 'editor' | 'outline' | 'bible' | 'settings';

export interface TourStep {
  /** CSS selector for the target element — always a stable `[data-tour="…"]`. */
  el: string;
  titleKey: TKey;
  bodyKey: TKey;
  /** Step only shown when the workspace AI level is at least this (1 = any AI, 3 = co-writer). */
  minLevel?: number;
}

/** Bump a surface's version to re-show its tour after a feature changes. */
export const TOUR_VERSIONS: Record<TourSurface, number> = {
  editor: 1,
  outline: 1,
  bible: 1,
  settings: 1,
};

export const TOURS: Record<TourSurface, TourStep[]> = {
  editor: [
    { el: '[data-tour="nav-tabs"]', titleKey: 'tourEditorNavTitle', bodyKey: 'tourEditorNavBody' },
    { el: '[data-tour="agent-panel"]', titleKey: 'tourEditorAgentTitle', bodyKey: 'tourEditorAgentBody', minLevel: 1 },
    { el: '[data-tour="write-beat"]', titleKey: 'tourEditorWriteBeatTitle', bodyKey: 'tourEditorWriteBeatBody', minLevel: 3 },
    { el: '[data-tour="snapshot-history"]', titleKey: 'tourEditorSnapTitle', bodyKey: 'tourEditorSnapBody' },
  ],
  outline: [
    { el: '[data-tour="outline-new-chapter"]', titleKey: 'tourOutlineNewTitle', bodyKey: 'tourOutlineNewBody' },
    { el: '[data-tour="outline-grid"]', titleKey: 'tourOutlineGridTitle', bodyKey: 'tourOutlineGridBody' },
  ],
  bible: [
    { el: '[data-tour="bible-type-switcher"]', titleKey: 'tourBibleTypesTitle', bodyKey: 'tourBibleTypesBody' },
    { el: '[data-tour="bible-add"]', titleKey: 'tourBibleAddTitle', bodyKey: 'tourBibleAddBody' },
  ],
  settings: [
    { el: '[data-tour="settings-ai-level"]', titleKey: 'tourSettingsLevelTitle', bodyKey: 'tourSettingsLevelBody' },
    { el: '[data-tour="settings-model"]', titleKey: 'tourSettingsModelTitle', bodyKey: 'tourSettingsModelBody', minLevel: 1 },
    { el: '[data-tour="settings-reasoning"]', titleKey: 'tourSettingsReasoningTitle', bodyKey: 'tourSettingsReasoningBody', minLevel: 1 },
    { el: '[data-tour="settings-replay-tours"]', titleKey: 'tourSettingsReplayTitle', bodyKey: 'tourSettingsReplayBody' },
  ],
};

// ── Seen-state (localStorage) ────────────────────────────────────────────────

const SEEN_KEY = 'xnovelist-tours-seen';
type SeenMap = Partial<Record<TourSurface, number>>;

function readSeen(): SeenMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as SeenMap;
  } catch {
    return {};
  }
}

function writeSeen(map: SeenMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

/** True when this surface hasn't been seen at its current version. */
export function shouldAutoRun(surface: TourSurface): boolean {
  return (readSeen()[surface] ?? 0) < TOUR_VERSIONS[surface];
}

export function markTourSeen(surface: TourSurface): void {
  const map = readSeen();
  map[surface] = TOUR_VERSIONS[surface];
  writeSeen(map);
}

/** Clear all seen-state so every page auto-runs again (Settings → Replay tours). */
export function resetAllTours(): void {
  writeSeen({});
}

// ── Launch ───────────────────────────────────────────────────────────────────

export interface StartTourOptions {
  /** Replay even if already seen (the header tour button uses this). */
  force?: boolean;
  /** Current workspace AI level; gates steps via `minLevel`. */
  aiLevel?: number;
  /** Called once the tour finishes (complete / skip / dismiss) — e.g. to restore panel state. */
  onEnd?: () => void;
}

/**
 * Launch a surface's tour. Returns true if it actually ran. Auto-skips steps whose
 * target element isn't currently in the DOM (e.g. AI off, distraction-free, mobile),
 * so a tour never points at a missing control. If nothing is targetable, it marks
 * the surface seen and does nothing.
 */
export function startTour(
  surface: TourSurface,
  t: Translate,
  opts: StartTourOptions = {}
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!opts.force && !shouldAutoRun(surface)) return false;

  const aiLevel = opts.aiLevel ?? 0;
  const steps = TOURS[surface]
    .filter((s) => aiLevel >= (s.minLevel ?? 0))
    .filter((s) => document.querySelector(s.el))
    .map((s) => ({
      element: s.el,
      popover: { title: t(s.titleKey), description: t(s.bodyKey) },
    }));

  if (steps.length === 0) {
    markTourSeen(surface);
    opts.onEnd?.();
    return false;
  }

  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    popoverClass: 'xn-tour',
    nextBtnText: t('tourNext'),
    prevBtnText: t('tourPrev'),
    doneBtnText: t('tourDone'),
    progressText: '{{current}} / {{total}}',
    steps,
    onDestroyed: () => {
      markTourSeen(surface);
      opts.onEnd?.();
    },
  });

  d.drive();
  return true;
}
