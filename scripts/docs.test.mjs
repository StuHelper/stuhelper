import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  root,
  validateDocumentation,
  validateDocLinksAndIndexes,
  validateMarkdownTables,
  validateMkdocsNav,
} from './docs.mjs';

test('repository documentation passes table, navigation and link boundary checks', () => {
  validateDocumentation(root);
});

test('markdown table validator rejects split tables without separators and ignores code blocks', () => {
  validateMarkdownTables(
    '# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```markdown\n| orphan | code |\n```\n',
    'valid.md',
  );
  assert.throws(
    () => validateMarkdownTables('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| orphan | row |\n', 'broken.md'),
    /Broken Markdown table without header separator at broken\.md:5/,
  );
  assert.throws(
    () => validateMarkdownTables('| single | row |\n', 'single.md'),
    /Broken Markdown table without header separator at single\.md:1/,
  );
});

test('mkdocs nav, category indexes and doc links reject duplicates, escaped paths and temporary branches', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-docs-check-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'docs/spec'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/README.md'), '| 分类 | 入口 |\n| --- | --- |\n| 规格 | [规格](spec/README.md) |\n');
  fs.writeFileSync(path.join(dir, 'docs/spec/topic.md'), '# Topic\n');
  fs.writeFileSync(
    path.join(dir, 'docs/spec/README.md'),
    '| 主题 | 说明 |\n| --- | --- |\n| [主题](topic.md) | 见 [主仓](https://github.com/StuHelper/stuhelper-next/blob/develop/README.md) |\n',
  );
  fs.writeFileSync(
    path.join(dir, 'mkdocs.yml'),
    'nav:\n  - 总览: README.md\n  - 规格:\n      - 导航: spec/README.md\n      - 主题: spec/topic.md\n',
  );
  validateMkdocsNav(dir);
  validateDocLinksAndIndexes(dir);

  fs.writeFileSync(
    path.join(dir, 'mkdocs.yml'),
    'nav:\n  - 总览: README.md\n  - 重复: README.md\n',
  );
  assert.throws(() => validateMkdocsNav(dir), /Duplicate mkdocs nav target: README\.md/);

  fs.writeFileSync(path.join(dir, 'mkdocs.yml'), 'nav:\n  - 总览: README.md\n');
  fs.writeFileSync(
    path.join(dir, 'docs/spec/README.md'),
    '| 主题 | 说明 |\n| --- | --- |\n| [一](topic.md) | 一 |\n| [二](topic.md) | 二 |\n',
  );
  assert.throws(() => validateDocLinksAndIndexes(dir), /Duplicate index entry/);

  fs.writeFileSync(path.join(dir, 'docs/spec/README.md'), '| 主题 | 说明 |\n| --- | --- |\n| [主题](topic.md) | 说明 |\n');
  fs.writeFileSync(path.join(dir, 'docs/spec/topic.md'), 'See [lock](../../workspace.lock.json).\n');
  assert.throws(() => validateDocLinksAndIndexes(dir), /Link escapes docs_dir/);

  fs.writeFileSync(
    path.join(dir, 'docs/spec/topic.md'),
    'See [branch](https://github.com/StuHelper/stuhelper-media/blob/codex/media-services/docs/spec/media.md).\n',
  );
  assert.throws(() => validateDocLinksAndIndexes(dir), /Unstable GitHub branch link/);
});

test('table validation ignores CommonMark indented and fenced code and preserves source lines', () => {
  const example = '# Example\n\n    | shell | output |\n\n\t| more | output |\n\n~~~~\n| fenced | output |\n~~~~\n';
  validateMarkdownTables(example, 'guide.md');
  assert.throws(() => validateMarkdownTables(example + '\n| broken | table |\n', 'guide.md'),
    /without header separator at guide\.md:11/);
  assert.throws(() => validateMarkdownTables('1. Item\n\n   | broken | table |\n', 'list.md'),
    /without header separator at list\.md:3/);
});
