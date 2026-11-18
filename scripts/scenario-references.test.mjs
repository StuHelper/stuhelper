import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyClientScenarios, verifyScenarios } from './workspace.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-references-'));
  t.after(() => fs.rmSync(dir, {recursive:true}));
  fs.writeFileSync(path.join(dir, 'spec.md'), '| MOD-01 | condition | result |');
  return dir;
}

test('Go and JS scenario references ignore comments and string content', t => {
  const dir = fixture(t);
  for (const [file, title, code] of [
    ['case_test.go', 'TestRetry', 'func TestRetry(t *testing.T) {}'],
    ['case.spec.ts', 'retry', "test('retry', () => {})"],
  ]) {
    const check = () => verifyScenarios(dir, {specifications:['spec.md'], scenario_tests:{'MOD-01':[file + '#' + title]}}, dir);
    for (const inactive of ['// ' + code, '/*\n' + code + '\n*/', '`\n' + code + '\n`']) {
      fs.writeFileSync(path.join(dir, file), inactive);
      assert.throws(check, /Missing scenario test/);
    }
    fs.writeFileSync(path.join(dir, file), code);
    check();
  }
});

test('test titles can include hashes and malformed references have an explicit error', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'case.spec.ts'), "test('issue #12', () => {})");
  const check = ref => verifyScenarios(dir, {specifications:['spec.md'], scenario_tests:{'MOD-01':[ref]}}, dir);
  check('case.spec.ts#issue #12');
  for (const ref of ['case.spec.ts', 'case.spec.ts#', '#name']) assert.throws(() => check(ref), /Invalid scenario reference/);
});

test('central references remain checked when the client also has its own scenarios', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'case.test.ts'), "it('active', () => {})");
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify({id:'web', scenario_tests:{'MOD-01':['case.test.ts#active']}}));
  const definition = {id:'web', specifications:['spec.md'], scenario_tests:{'MOD-01':['case.test.ts#deleted']}};
  assert.throws(() => verifyClientScenarios(dir, definition, {name:'web',directory:dir}), /Missing scenario test/);
});
