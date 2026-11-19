import assert from 'node:assert/strict';
import { test } from 'node:test';
import { integrationRefs, lockedCandidateSummary } from './integration-refs.mjs';

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
