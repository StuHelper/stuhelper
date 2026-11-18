import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { snapshot } from './workspace.mjs';

test('writing a partial checkout cannot discard a recorded project', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-snapshot-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  fs.writeFileSync(path.join(root, 'mani.yaml'), 'projects: {backend: {path: workspace/backend}}');
  const file = path.join(root, 'workspace.lock.json');
  const original = JSON.stringify({schema_version: 1, projects: {backend: {
    repository: 'https://github.com/StuHelper/stuhelper-backend.git',
    revision: 'a'.repeat(40), dirty: false,
  }}});
  fs.writeFileSync(file, original);
  assert.deepEqual(snapshot(root).projects, {});
  assert.throws(() => snapshot(root, true), /backend/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});
