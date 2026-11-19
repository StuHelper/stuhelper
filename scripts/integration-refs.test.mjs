import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { integrationRefs, lockedCandidateSummary, pullRequestLockChanged } from './integration-refs.mjs';

const names = ['platform', 'web', 'admin', 'catalog', 'reviews', 'moderation', 'storage', 'media', 'resources', 'backend'];
const current = {
  schema_version: 1, release: 'v0.1.26',
  projects: Object.fromEntries(names.map(name => [name, {
    repository: `https://github.com/StuHelper/stuhelper-${name}.git`, tag: 'v0.1.0',
    revision: 'c'.repeat(40), dirty: false,
  }])),
};
function candidate() {
  const lock = structuredClone(current);
  lock.release = 'v2026.11.19.1';
  lock.projects.storage = { ...lock.projects.storage, tag: 'v0.1.1', revision: 'a'.repeat(40) };
  return lock;
}
const pr = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'develop', GITHUB_HEAD_REF: 'fix/new-topic' };

test('ordinary development resolves develop even with the published lock present', () => {
  for (const env of [pr, { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/develop' }]) {
    assert.equal(integrationRefs(env, current).catalog, 'develop');
  }
});

test('a changed PR lock selects clean candidates independently of branch name', () => {
  const env = { ...pr, LOCK_CHANGED: 'true' };
  const lock = candidate();
  assert.equal(integrationRefs(env, lock).storage, lock.projects.storage.revision);
  delete lock.release;
  assert.equal(integrationRefs(env, lock).web, lock.projects.web.revision);
  lock.projects.web.dirty = true;
  assert.throws(() => integrationRefs(env, lock), /Uncommitted/);
  assert.throws(() => integrationRefs(env), /lock/i);
});

test('main and manual runs can replay the exact published combination', () => {
  for (const env of [{GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main'}, { GITHUB_EVENT_NAME: 'workflow_dispatch' }]) {
    assert.equal(integrationRefs(env, current).web, current.projects.web.revision);
  }
  assert.equal(integrationRefs({ GITHUB_EVENT_NAME: 'workflow_dispatch', WEB: 'b'.repeat(40) }, current).web, 'b'.repeat(40));
  assert.throws(() => integrationRefs({ WEB: 'invalid' }, current));
});

test('a new release candidate cannot reuse the known defective storage commit under any tag', () => {
  const lock = candidate();
  lock.projects.storage.revision = '70d0785c66ad16809f674d34566bbdbfc7de4632';
  for (const env of [{ ...pr, LOCK_CHANGED: 'true' }, { ...pr, GITHUB_BASE_REF: 'main' }]) {
    assert.throws(() => integrationRefs(env, lock), /storage/);
    assert.throws(() => integrationRefs({ ...env, STORAGE: 'b'.repeat(40) }, lock), /storage/);
  }
  delete lock.projects.storage;
  assert.throws(() => integrationRefs({ ...pr, GITHUB_BASE_REF: 'main', STORAGE: 'b'.repeat(40) }, lock), /storage/);
});

test('locked summary verifies every record including private providers and accepts both tag formats', () => {
  const lock = candidate();
  lock.projects.backend.tag = 'v2026.11.19.1';
  assert(lockedCandidateSummary(lock).includes('| backend | v2026.11.19.1 |'));
  for (const change of [{ dirty: true }, { revision: 'develop' }, { tag: 'latest' }, { repository: 'unexpected' }]) {
    assert.throws(() => lockedCandidateSummary({ ...lock, projects: { backend: { ...lock.projects.backend, ...change } } }));
  }
});

test('a shallow PR merge compares the lock to the integrated base', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-refs-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'source');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', ...args], { cwd: repo, stdio: 'pipe' });
  git('init', '-b', 'develop');
  git('commit', '--allow-empty', '-m', 'original base');
  git('switch', '-c', 'feature');
  git('commit', '--allow-empty', '-m', 'feature');
  git('switch', 'develop');
  fs.writeFileSync(path.join(repo, 'workspace.lock.json'), '{}');
  git('add', '.');
  git('commit', '-m', 'new base lock');
  git('merge', '--no-ff', 'feature', '-m', 'PR merge');
  const checkout = path.join(temp, 'checkout');
  git('clone', '--depth=2', pathToFileURL(repo).href, checkout);
  assert.equal(pullRequestLockChanged(checkout), false);
  git('switch', '-c', 'update');
  fs.writeFileSync(path.join(repo, 'workspace.lock.json'), '{"schema_version":1}');
  git('commit', '-am', 'candidate');
  git('switch', 'develop');
  git('merge', '--no-ff', 'update', '-m', 'candidate PR merge');
  assert.equal(pullRequestLockChanged(repo), true);
});
