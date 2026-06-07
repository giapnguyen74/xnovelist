/**
 * Split reasoning-model "thinking" out of a response. Some OpenAI-compatible
 * reasoning models (deepseek-r1, QwQ, etc.) emit their chain-of-thought inline
 * in the content wrapped in <think>…</think> (or <thinking>…</thinking>). We
 * strip it from the usable text but return it so a debug view can show it.
 */
export function stripThinking(raw: string): { clean: string; thinking: string } {
  if (!raw) return { clean: '', thinking: '' };
  const thinkParts: string[] = [];
  // 1) Well-formed <think>…</think> pairs.
  let clean = raw.replace(/<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
    thinkParts.push(String(inner).trim());
    return '';
  });
  // 2) A leading open tag with no close (response cut off mid-thought): treat
  //    everything after the open tag as thinking.
  const openOnly = clean.match(/<(?:think|thinking|reasoning)>([\s\S]*)$/i);
  if (openOnly && !/<\/(?:think|thinking|reasoning)>/i.test(clean)) {
    thinkParts.push(openOnly[1].trim());
    clean = clean.slice(0, openOnly.index).trim();
  }
  return { clean: clean.trim(), thinking: thinkParts.filter(Boolean).join('\n\n') };
}

/**
 * Tolerant JSON extraction. Models often wrap JSON in prose or ```json fences.
 * This pulls the first balanced JSON object/array out of the text and parses it.
 * Returns null on failure; the caller decides whether to run a repair retry.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const text = raw.trim();

  // Fast path: the whole thing is JSON.
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }

  // Strip a ```json ... ``` (or plain ```) fence if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }

  // Scan for the first balanced { } or [ ] block.
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
