// Reads the project's documentation (docs/, CLAUDE.md). Helpers only: no assertion of a criterion.
import { repoFile } from './repo.mjs';

export const architectureDoc = () => repoFile('docs/architecture.md');
export const uiDoc = () => repoFile('docs/ui.md');
export const projectMemoryDoc = () => repoFile('CLAUDE.md');
export const productDoc = () => repoFile('docs/prd.md');

/**
 * The lines from the one that starts with `start` up to (not including) the one that starts with `stop`, flattened
 * to one line; '' when `start` is absent. Used for plain-text sections (no `## ` heading) such as "Endgame trainer:".
 */
export function between(markdown, start, stop) {
  const lines = markdown.split(/\r?\n/);
  const first = lines.findIndex((line) => line.startsWith(start));
  if (first < 0) return '';
  const body = [];
  for (const line of lines.slice(first + 1)) {
    if (line.startsWith(stop)) break;
    body.push(line);
  }
  return flat([lines[first], ...body].join('\n'));
}

/** The text with every run of whitespace (line breaks included, NBSP too) turned into one space. */
export const flat = (text) => text.replace(/\s+/g, ' ').trim();

/** The body of the `## <title>` section, without its heading, up to the next `## ` heading; '' when absent. */
export function section(markdown, title) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.indexOf(`## ${title}`);
  if (start < 0) return '';
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    body.push(line);
  }
  return body.join('\n').trim();
}

/**
 * The bullet that starts with "- `<name>`:", its wrapped continuation lines included, flattened to one line;
 * '' when there is none.
 */
export function bullet(markdown, name) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`- \`${name}\`:`));
  if (start < 0) return '';
  const out = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.startsWith('- ') || line.startsWith('#')) break;
    out.push(line);
  }
  return flat(out.join('\n'));
}

/** Whether the text shows `token` in code backticks, as a whole token. */
export const hasCode = (text, token) => text.includes(`\`${token}\``);

/** The markdown table row whose first cell is `name` (as in "| `name` |"), flattened to one line; '' when absent. */
export function tableRow(markdown, name) {
  const line = markdown.split(/\r?\n/).find((l) => l.startsWith(`| \`${name}\` |`));
  return line ? flat(line) : '';
}

/** The cells of the markdown table row whose first cell is `name`, trimmed; [] when absent. */
export function tableCells(markdown, name) {
  const row = tableRow(markdown, name);
  return row ? row.split('|').slice(1, -1).map((cell) => cell.trim()) : [];
}
