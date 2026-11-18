import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import YAML from 'yaml';

const markdown = new MarkdownIt('commonmark');

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkMarkdown(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(full));
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files.sort();
}

function* nonCodeLines(content) {
  const lines = content.split(/\r?\n/);
  for (const token of markdown.parse(content, {})) {
    if (token.type !== 'fence' && token.type !== 'code_block') continue;
    const [start, end] = token.map;
    for (let index = start; index < end; index++) lines[index] = '';
  }
  for (const [index, line] of lines.entries()) yield { lineNumber: index + 1, line };
}

export function validateMarkdownTables(content, label) {
  const separatorPattern = /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;
  let block = [];
  let startLine = 0;
  const flush = () => {
    if (!block.length) return;
    assert(
      block.length >= 2 && separatorPattern.test(block[1]),
      `Broken Markdown table without header separator at ${label}:${startLine}`,
    );
    block = [];
  };
  for (const { lineNumber, line } of nonCodeLines(content)) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!block.length) startLine = lineNumber;
      block.push(line);
    } else {
      flush();
    }
  }
  flush();
}

export function validateMkdocsNav(directory = root) {
  const mkdocsFile = path.join(directory, 'mkdocs.yml');
  const docsDir = path.join(directory, 'docs');
  const raw = fs.readFileSync(mkdocsFile, 'utf8').replace(/!!python\/name:[^\s]+/g, '""');
  const config = YAML.parse(raw);
  const seen = new Set();
  const visit = entries => {
    for (const entry of entries ?? []) {
      if (typeof entry === 'string') {
        assert(!seen.has(entry), `Duplicate mkdocs nav target: ${entry}`);
        assert(fs.existsSync(path.join(docsDir, entry)), `Missing mkdocs nav file: ${entry}`);
        seen.add(entry);
      } else if (entry && typeof entry === 'object') {
        for (const value of Object.values(entry)) {
          if (typeof value === 'string') visit([value]);
          else if (Array.isArray(value)) visit(value);
        }
      }
    }
  };
  visit(config.nav);
}

export function validateDocLinksAndIndexes(directory = root) {
  const docsDir = path.resolve(directory, 'docs');
  const stableRef = /^(?:develop|main|v\d+\.\d+\.\d+(?:\.\d+)?|[0-9a-f]{40})$/;
  for (const file of walkMarkdown(docsDir)) {
    const relativeFile = path.relative(directory, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    validateMarkdownTables(content, relativeFile);
    const isIndex = path.basename(file) === 'README.md';
    const indexTargets = new Set();
    for (const { lineNumber, line } of nonCodeLines(content)) {
      const stripped = line.replace(/`[^`]*`/g, '');
      const isTableRow = /^\s*\|.*\|\s*$/.test(line);
      for (const match of stripped.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = match[1];
        if (target.startsWith('#') || target.startsWith('mailto:')) continue;
        if (/^https?:\/\//.test(target)) {
          const ghMatch = /^https:\/\/github\.com\/StuHelper\/[^/]+\/(?:blob|tree)\/([^/#?]+)/.exec(target);
          if (ghMatch) {
            assert(
              stableRef.test(ghMatch[1]),
              `Unstable GitHub branch link at ${relativeFile}:${lineNumber} (${target})`,
            );
          }
          continue;
        }
        const cleanPath = target.split('#')[0].split('?')[0];
        if (!cleanPath) continue;
        const resolved = path.resolve(path.dirname(file), cleanPath);
        const relToDocs = path.relative(docsDir, resolved);
        assert(
          !relToDocs.startsWith('..') && !path.isAbsolute(relToDocs),
          `Link escapes docs_dir at ${relativeFile}:${lineNumber} (${target})`,
        );
        if (isIndex && isTableRow) {
          const normalized = relToDocs.replace(/\\/g, '/');
          assert(!indexTargets.has(normalized), `Duplicate index entry in ${relativeFile}:${lineNumber} (${cleanPath})`);
          indexTargets.add(normalized);
        }
      }
    }
  }
}

export function validateDocumentation(directory = root) {
  for (const topDoc of ['README.md', 'CONTRIBUTING.md', 'AGENTS.md']) {
    const full = path.join(directory, topDoc);
    if (fs.existsSync(full)) validateMarkdownTables(fs.readFileSync(full, 'utf8'), topDoc);
  }
  validateMkdocsNav(directory);
  validateDocLinksAndIndexes(directory);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validateDocumentation(root);
    console.log('PASS: documentation tables, navigation uniqueness and link boundaries');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
