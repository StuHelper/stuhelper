import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

test('browser jobs use the exact commits checked by the contract job', t => {
  const workflow = YAML.parse(fs.readFileSync(new URL('../.github/workflows/applications.yml', import.meta.url), 'utf8'));
  const { contracts, browser } = workflow.jobs;
  const record = contracts.steps.find(step => step.id === 'checked');
  assert.ok(record, 'Missing step that records checked-out commits');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'next-browser-refs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const expected = {};
  for (const name of ['platform', 'web', 'admin']) {
    const repo = path.join(root, 'workspace', name);
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=Fixture',
      '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'develop');
    git('commit', '--allow-empty', '-qm', 'checked ' + name);
    expected[name] = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-qm', 'later develop');
    git('switch', '--quiet', '--detach', expected[name]);

    assert.equal(contracts.outputs[name], '${{ steps.checked.outputs.' + name + ' }}');
    const checkout = browser.steps.find(step => step.with?.path === 'workspace/' + name);
    assert.equal(checkout.with.ref, '${{ needs.contracts.outputs.' + name + ' }}');
  }
  const output = path.join(root, 'outputs');
  execFileSync('bash', ['-e', '-o', 'pipefail', '-c', record.run], { cwd: root, env: { ...process.env, GITHUB_OUTPUT: output } });
  const exported = Object.fromEntries(fs.readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
  assert.deepEqual(exported, expected);
});
