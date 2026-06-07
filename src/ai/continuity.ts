/**
 * Continuity document helpers for xnovelist.
 *
 * One continuity document per chapter lives at:
 *   Continuity/chapter-{id}.md
 *
 * The document is the single source of truth. `Chapter.synopsis` is a
 * derived *cache* computed from the top of that document — it is never
 * separately authored.
 */

/** Template for a fresh continuity document. N and title are display-only. */
export function makeContinuityTemplate(chapterN: number, chapterTitle: string): string {
  return [
    `# Continuity: Chapter ${chapterN} — ${chapterTitle}`,
    '',
    '## Synopsis',
    '',
    '## What the reader knows',
    '',
    '## Hidden / dramatic irony',
    '',
    '## Unresolved threads',
    '',
    '## Constraints carried forward',
    '',
  ].join('\n');
}

/**
 * Derive a short synopsis preview from a continuity document.
 *
 * Strategy: strip all heading lines (## Synopsis, ## What the reader knows, …),
 * collapse whitespace, and take the first `maxChars` characters. Because the
 * template places synopsis content immediately after the ## Synopsis heading,
 * the top-N characters of the stripped text *are* the synopsis. This is robust
 * to template drift: if the writer reshapes the document the preview still
 * reflects its opening content.
 */
export function deriveSynopsis(continuityMd: string, maxChars = 180): string {
  const md = continuityMd || '';
  const lines = md.split('\n');
  const headerIndices: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i].trim())) {
      headerIndices.push(i);
    }
  }

  let text = '';

  if (headerIndices.length === 0) {
    // No headers at all, take the whole text
    text = lines.join('\n');
  } else {
    // Find the first non-empty text block between headers
    for (let k = 0; k < headerIndices.length; k++) {
      const startLineIdx = headerIndices[k] + 1;
      const endLineIdx = k + 1 < headerIndices.length ? headerIndices[k + 1] : lines.length;

      const blockLines = lines.slice(startLineIdx, endLineIdx);
      const blockText = blockLines.join('\n')
        .replace(/^#{1,6}\s.*$/gm, '') // drop any other subheadings
        .replace(/\s+/g, ' ')
        .trim();

      if (blockText) {
        text = blockText;
        break;
      }
    }

    // Fallback: if all blocks between headers were empty, take everything after the first header
    if (!text && headerIndices.length > 0) {
      const blockLines = lines.slice(headerIndices[0] + 1);
      text = blockLines.join('\n')
        .replace(/^#{1,6}\s.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + '…' : text;
}
