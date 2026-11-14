// Reads the project's documentation (docs/, CLAUDE.md). Helpers only: no assertion of a criterion.
import { repoFile } from './repo.mjs';

export const architectureDoc = () => repoFile('docs/architecture.md');
export const uiDoc = () => repoFile('docs/ui.md');
export const projectMemoryDoc = () => repoFile('CLAUDE.md');

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
