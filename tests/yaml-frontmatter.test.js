import { test } from 'node:test';
import assert from 'node:assert';
import { extractFrontmatter, parseFrontmatter } from '../app/lib/yaml-frontmatter.js';

test('extractFrontmatter returns null for file without frontmatter', () => {
  const text = '# Hello\n\nNo frontmatter here.';
  assert.strictEqual(extractFrontmatter(text), null);
});

test('extractFrontmatter returns the yaml block for a standard file', () => {
  const text = '---\nname: Titus\npoints: 90\n---\n\n# Body\n';
  assert.strictEqual(extractFrontmatter(text), 'name: Titus\npoints: 90');
});

test('extractFrontmatter handles --- inside body (markdown table separators) correctly', () => {
  const text = '---\nname: Purge\n---\n\n# Body\n\n| col |\n|-----|\n| x |\n';
  assert.strictEqual(extractFrontmatter(text), 'name: Purge');
});

test('parseFrontmatter parses valid YAML', async () => {
  const text = '---\nname: Titus\npoints: 90\n---\n\n# Body';
  const data = await parseFrontmatter(text);
  assert.deepStrictEqual(data, { name: 'Titus', points: 90 });
});

test('parseFrontmatter returns null for missing frontmatter', async () => {
  assert.strictEqual(await parseFrontmatter('# No frontmatter'), null);
});

test('extractFrontmatter handles frontmatter at end of file with no trailing newline', () => {
  const text = '---\nname: Titus\n---';
  assert.strictEqual(extractFrontmatter(text), 'name: Titus');
});
