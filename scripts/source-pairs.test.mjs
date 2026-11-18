import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifySnapshotPairs } from './workspace.mjs';

test('each client OpenAPI snapshot has its own source record even when providers are shared', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-pairs-'));
  t.after(() => fs.rmSync(root, {recursive:true}));
  const dir = path.join(root, 'contracts');
  fs.mkdirSync(dir);
  const client = {name:'admin',directory:root};
  for (const file of ['platform.openapi.yaml','platform-admin.openapi.json','platform.source.json','client-cases.json']) {
    fs.writeFileSync(path.join(dir, file), '{}');
  }
  assert.throws(() => verifySnapshotPairs(client), /platform-admin.source.json/);
  fs.writeFileSync(path.join(dir,'platform-admin.source.json'), '{}');
  verifySnapshotPairs(client);
  fs.unlinkSync(path.join(dir, 'platform.openapi.yaml'));
  assert.throws(() => verifySnapshotPairs(client), /platform.source.json/);
});
