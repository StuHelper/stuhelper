import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const modules = ['platform', 'web', 'admin', 'catalog', 'reviews', 'moderation', 'storage', 'media', 'resources'];
const versionTag = /^v(?:\d+\.\d+\.\d+|\d{4}\.\d{2}\.\d{2}\.\d+)$/;
function useLock(env, snapshot) {
  if (env.GITHUB_EVENT_NAME === 'pull_request') return env.LOCK_CHANGED === 'true' || env.GITHUB_BASE_REF === 'main';
  return Boolean(snapshot?.release && (env.GITHUB_REF === 'refs/heads/main' || env.GITHUB_EVENT_NAME === 'workflow_dispatch'));
}
export function integrationRefs(env, snapshot) {
  const locked = useLock(env, snapshot);
  if (locked) {
    assert(snapshot, 'Missing workspace lock');
    lockedCandidateSummary(snapshot);
    if (snapshot.release && env.GITHUB_EVENT_NAME === 'pull_request') {
      const storage = snapshot.projects.storage;
      assert(storage, 'Missing release provider: storage');
      assert.notEqual(storage.revision, '70d0785c66ad16809f674d34566bbdbfc7de4632',
        'Release blocked: storage v0.1.0 loses concurrent quota updates (SP-07, SP-16)');
    }
  }
  const refs = {};
  for (const name of modules) {
    const explicit = env[name.toUpperCase()] || '';
    if (explicit) assert.match(explicit, /^[a-f0-9]{40}$/, `Invalid ${name} candidate`);
    let revision = explicit || 'develop';
    if (locked) {
      const record = snapshot?.projects?.[name];
      assert.equal(record?.repository, `https://github.com/StuHelper/stuhelper-${name}.git`);
      assert.equal(record?.dirty, false, `Uncommitted ${name} candidate`);
      assert.match(record?.revision ?? '', /^[a-f0-9]{40}$/, `Missing ${name} candidate`);
      revision = explicit || record.revision;
    }
    refs[name] = revision;
  }
  return refs;
}

export function lockedCandidateSummary(snapshot) {
  assert.equal(snapshot?.schema_version, 1);
  if (snapshot.release) assert.match(snapshot.release, versionTag);
  const entries = Object.entries(snapshot.projects ?? {});
  assert(entries.length, 'Missing locked candidates');
  const rows = entries.map(([name, record]) => {
    assert.match(name, /^[a-z][a-z-]*$/);
    assert.equal(record.repository, `https://github.com/StuHelper/stuhelper-${name}.git`);
    assert.equal(record.dirty, false, `Uncommitted ${name} candidate`);
    assert.match(record.revision, /^[a-f0-9]{40}$/);
    if (snapshot.release || record.tag !== undefined) assert.match(record.tag ?? '', versionTag, `Missing release tag: ${name}`);
    return `| ${name} | ${record.tag || '—'} | ${record.revision} |`;
  });
  return `### Locked source combination\n\nFrom workspace.lock.json. The repositories actually checked out and tested are listed separately in Tested source combination.\n\n| Repository | Tag | Commit |\n| --- | --- | --- |\n${rows.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = fs.existsSync('workspace.lock.json') ? JSON.parse(fs.readFileSync('workspace.lock.json', 'utf8')) : undefined;
  const refs = integrationRefs(process.env, snapshot);
  if (process.env.GITHUB_STEP_SUMMARY && useLock(process.env, snapshot)) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lockedCandidateSummary(snapshot));
  }
  for (const [name, ref] of Object.entries(refs)) {
    console.log(`${name}: ${ref}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${ref}\n`);
  }
}
