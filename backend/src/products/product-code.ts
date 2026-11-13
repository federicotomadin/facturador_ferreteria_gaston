// Labels use Code 39, where "*" is the start/stop delimiter ("*00001*").
// Depending on its configuration the scanner may or may not send them.
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/^\*+|\*+$/g, '').trim();
}
