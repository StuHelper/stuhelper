import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import YAML from 'yaml';

test('architecture hook validates the Git index, including partially staged files', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-index-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const repo = path.join(fixture, 'repo');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  fs.mkdirSync(path.join(repo, 'scripts'));
  const input = path.join(repo, 'architecture.json');
  const check = "import fs from 'node:fs'; if (!JSON.parse(fs.readFileSync('architecture.json')).valid) throw new Error('invalid staged architecture');";
  fs.writeFileSync(path.join(repo, 'scripts/architecture.mjs'), check);
  fs.writeFileSync(path.join(repo, 'scripts/workspace.mjs'), check);
  fs.writeFileSync(path.join(repo, 'scripts/example.test.mjs'), check);
  const script = new URL('check-staged-architecture.sh', import.meta.url);
  fs.copyFileSync(script, path.join(repo, 'scripts/check-staged-architecture.sh'));
  fs.writeFileSync(input, '{"valid":true}');
  git('add', '.');
  const command = YAML.parse(fs.readFileSync(new URL('../lefthook.yml', import.meta.url), 'utf8'))['pre-commit'].commands.architecture.run;
  const run = () => spawnSync('bash', ['-c', command], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_DIR: path.join(repo,'.git'), GIT_WORK_TREE: repo, GIT_INDEX_FILE: path.join(repo,'.git/index') },
  });
  fs.writeFileSync(input, '{"valid":false}');
  git('add', 'architecture.json');
  fs.writeFileSync(input, '{"valid":true}');
  let result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid staged architecture/);
  assert.equal(git('show', ':architecture.json'), '{"valid":false}');
  git('add', 'architecture.json');
  fs.writeFileSync(input, '{"valid":false}');
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(input, 'utf8'), '{"valid":false}');
  assert.equal(git('show', ':architecture.json'), '{"valid":true}');
});
