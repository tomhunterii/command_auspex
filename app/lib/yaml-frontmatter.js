// app/lib/yaml-frontmatter.js
//
// Extract and parse YAML frontmatter from a markdown file.
// IMPORTANT: matches on line-boundary ^---, NOT on the substring '---',
// because markdown tables can contain --- as column separators and would
// break a naive split.
const FRONTMATTER_RE = /^---\r?\n(.*?)\r?\n---(?:\r?\n|$)/s;

export function extractFrontmatter(text) {
  const m = FRONTMATTER_RE.exec(text);
  return m ? m[1] : null;
}

let yamlModulePromise = null;
async function loadYaml() {
  if (globalThis.jsyaml) return globalThis.jsyaml;
  if (!yamlModulePromise) yamlModulePromise = import('js-yaml').then(m => m.default ?? m);
  return yamlModulePromise;
}

export async function parseFrontmatter(text) {
  const fm = extractFrontmatter(text);
  if (fm === null) return null;
  const yaml = await loadYaml();
  return yaml.load(fm);
}
