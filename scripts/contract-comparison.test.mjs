import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compareContracts } from './workspace.mjs';

test('contract comparison uses only the installed binary and propagates its decision', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-check-'));
  t.after(() => fs.rmSync(dir, {recursive:true}));
  const before = path.join(dir, 'before.yaml'), after = path.join(dir, 'after.yaml');
  for (const file of [before, after]) fs.writeFileSync(file, 'original');
  const bin = path.join(dir, 'oasdiff');
  compareContracts(before, after, bin);
  fs.writeFileSync(after, 'changed');
  assert.throws(() => compareContracts(before, after, bin), /setup-contracts/);
  fs.writeFileSync(bin, '#!/bin/sh\nprintf "%s\\n" "$@" > "$2.args"\nexit 1\n', {mode:0o700});
  assert.throws(() => compareContracts(before, after, bin), err => err.status === 1);
  assert.deepEqual(fs.readFileSync(before + '.args','utf8').trim().split('\n'),
    ['breaking', before, after, '--allow-external-refs=false', '--fail-on', 'WARN']);
});
