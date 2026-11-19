import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { verifyLocalePolicy, goWorkspace, parseCommand, verifyWorkspaceScenarios, verifyScenarios, verifyClientScenarios, verifySource, verifyAcademicSource, verifyContractSource, verifyClientContracts } from './workspace.mjs';

const digest = text => crypto.createHash('sha256').update(text).digest('hex');

test('client contracts are checked against their declared version, allowing a newer provider', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-contract-'));
  try {
    fs.mkdirSync(path.join(directory, 'contracts'));
    const body = 'openapi: 3.1.0\ninfo:\n  version: 0.1.0\n';
    fs.writeFileSync(path.join(directory, 'contracts/platform.openapi.yaml'), body);
    const source = { repository: 'StuHelper/stuhelper-platform', revision: 'a'.repeat(40), version: '0.1.0', sha256: digest(body), files: { 'contracts/platform.openapi.yaml': 'contracts/platform.openapi.yaml', 'sdk/platform.gen.ts': 'src/api/platform.gen.ts', 'contracts/client-cases.json': 'contracts/client-cases.json' } };
    fs.mkdirSync(path.join(directory, 'src/api'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'src/api/platform.gen.ts'), body);
    fs.writeFileSync(path.join(directory, 'contracts/client-cases.json'), body);
    const provider = { url: 'https://github.com/StuHelper/stuhelper-platform.git' };
    const client = { name: 'web', directory };
    verifySource(provider, client, source, (revision, filename) => { assert.equal(revision, source.revision); assert(Object.hasOwn(source.files, filename)); return body; });
    assert.throws(() => verifySource(provider, client, { ...source, files: {} }, () => body), /must cover/);
    assert.throws(() => verifySource(provider, client, { ...source, sha256: 'bad' }, () => body), /digest/);
    fs.writeFileSync(path.join(directory, 'contracts/platform.openapi.yaml'), body + 'tampered: true\n');
    assert.throws(() => verifySource(provider, client, source, () => body), /Snapshot differs/);
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('workspace generation uses installed Go repositories and preserves custom files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-workspace-'));
  try {
    fs.mkdirSync(path.join(directory, 'architecture'));
    fs.mkdirSync(path.join(directory, 'workspace/platform'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'architecture/toolchains.yaml'), '{"go":"1.27.3"}');
    fs.writeFileSync(path.join(directory, 'mani.yaml'), 'projects:\n  platform:\n    path: workspace/platform\n  web:\n    path: workspace/web\n');
    fs.writeFileSync(path.join(directory, 'workspace/platform/go.mod'), 'module example.test/platform\n');
    goWorkspace(directory);
    const output = path.join(directory, 'go.work');
    assert.match(fs.readFileSync(output, 'utf8'), /workspace\/platform/);
    assert.doesNotMatch(fs.readFileSync(output, 'utf8'), /workspace\/web/);
    fs.mkdirSync(path.join(directory, 'custom'));
    fs.writeFileSync(path.join(directory, 'custom/go.mod'), 'module example.test/custom\ngo 1.27.3\n');
    fs.appendFileSync(output, '// custom local module\nuse ./custom\n');
    goWorkspace(directory);
    assert.match(fs.readFileSync(output, 'utf8'), /custom local module/);
    assert.match(fs.readFileSync(output, 'utf8'), /use \.\/custom/);
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('implemented scenarios reference an existing specification and executable test', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-scenario-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  fs.writeFileSync(path.join(directory, 'spec.md'), '| MOD-06 | condition | result |');
  fs.writeFileSync(path.join(directory, 'module_test.go'), 'func TestOptional(t *testing.T) {}');
  const definition = { specifications: ['spec.md'], scenario_tests: { 'MOD-06': ['module_test.go#TestOptional'] } };
  verifyScenarios(directory, definition, directory);
  fs.writeFileSync(path.join(directory, 'spec.md'), '| MOD-06：condition | result |');
  verifyScenarios(directory, definition, directory);
  fs.appendFileSync(path.join(directory, 'spec.md'), '\n| AE-ACCESS-07：denied | closed |\n| SV-TEACHER-01 | verified |\n| I18N-06 | RTL |');
  for (const id of ['AE-ACCESS-07', 'SV-TEACHER-01', 'I18N-06']) verifyScenarios(directory, { ...definition, scenario_tests: { [id]: ['module_test.go#TestOptional'] } }, directory);
  assert.throws(() => verifyScenarios(directory, { ...definition, scenario_tests: { 'AE-ACCESS-99': ['module_test.go#TestOptional'] } }, directory), /Unknown implemented scenario/);
  assert.throws(() => verifyScenarios(directory, { ...definition, scenario_tests: { 'ae-ACCESS-07': ['module_test.go#TestOptional'] } }, directory), /Invalid scenario/);
  assert.throws(() => verifyScenarios(directory, { ...definition, scenario_tests: { 'MOD-99': ['module_test.go#TestOptional'] } }, directory), /Unknown implemented scenario/);
  fs.writeFileSync(path.join(directory, 'plugin.test.mjs'), "test('private messages #1', () => {});");
  verifyScenarios(directory, { ...definition, scenario_tests: { 'MOD-06': ['plugin.test.mjs#private messages #1'] } }, directory);
  assert.throws(() => verifyScenarios(directory, { ...definition, scenario_tests: { 'MOD-06': ['plugin.test.mjs#missing test'] } }, directory), /Missing scenario test/);
  fs.writeFileSync(path.join(directory, 'module_test.go'), '// func TestOptional(t *testing.T) {}');
  assert.throws(() => verifyScenarios(directory, definition, directory), /Missing scenario test/);
  fs.writeFileSync(path.join(directory, 'module_test.go'), '');
  assert.throws(() => verifyScenarios(directory, definition, directory), /Missing scenario test/);
});

test('client manifests resolve TypeScript and browser tests against central specifications', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-client-scenarios-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  fs.writeFileSync(path.join(directory, 'spec.md'), '| RES-CLIENT-01 | Retry original request |');
  fs.writeFileSync(path.join(directory, 'api.test.ts'), "it('retries original request', async () => {});");
  fs.writeFileSync(path.join(directory, 'purchase.spec.mjs'), 'memberTest("waits for delivery; then downloads", async () => {});');
  const manifest = { id: 'web', scenario_tests: { 'RES-CLIENT-01': ['api.test.ts#retries original request', 'purchase.spec.mjs#waits for delivery; then downloads'] } };
  const write = () => fs.writeFileSync(path.join(directory, 'module.json'), JSON.stringify(manifest));
  const definition = { id: 'web', specifications: ['spec.md'] };
  const client = { name: 'web', directory };
  write();
  verifyClientScenarios(directory, definition, client);
  manifest.scenario_tests['RES-CLIENT-02'] = ['api.test.ts#retries original request'];
  write();
  assert.throws(() => verifyClientScenarios(directory, definition, client), /Unknown implemented scenario/);
  delete manifest.scenario_tests['RES-CLIENT-02'];
  manifest.scenario_tests['RES-CLIENT-01'] = ['purchase.spec.mjs#missing case'];
  write();
  assert.throws(() => verifyClientScenarios(directory, definition, client), /Missing scenario test/);
});

test('locale-parameterized scenarios require the exact behavior name and locale suffix', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-locale-scenario-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  fs.writeFileSync(path.join(directory, 'spec.md'), '| MC-01 | Week navigation |');
  const definition = { specifications: ['spec.md'], scenario_tests: { 'MC-01': ['schedule.spec.mjs#week navigation'] } };
  const source = value => fs.writeFileSync(path.join(directory, 'schedule.spec.mjs'), value);
  source('test(`week navigation (${locale})`, async () => {});');
  verifyScenarios(directory, definition, directory);
  for (const value of ['test(`other week navigation (${locale})`, () => {});', 'test(`week navigation extra (${locale})`, () => {});', 'test(`week navigation (${anything})`, () => {});', 'test(`week navigation ${locale}`, () => {});']) {
    source(value);
    assert.throws(() => verifyScenarios(directory, definition, directory), /Missing scenario test/);
  }
});



test('standalone architecture validation is independent of stale sibling checkouts', async t => {
  const { validate, toolchains } = await import('./workspace.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-independent-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'architecture'));
  fs.writeFileSync(path.join(directory, 'mani.yaml'), 'sync_remotes: false\nsync_gitignore: false\nremove_orphaned_worktrees: false\nspecs:\n  default:\n    ignore_errors: false\n    ignore_non_existing: false\nprojects:\n  web:\n    path: workspace/web\n    url: https://github.com/StuHelper/stuhelper-web.git\n    branch: develop\n');
  fs.writeFileSync(path.join(directory, 'architecture/modules.yaml'), 'modules: []\noperations: []\napplications:\n  - repository: StuHelper/stuhelper-web\n');
  const versions = { node: '24.22.1', go: '1.27.3', pnpm: '10.33.4', lefthook: '2.2.2' };
  fs.writeFileSync(path.join(directory, 'architecture/toolchains.yaml'), JSON.stringify(versions));
  const pkg = { engines: { node: versions.node, pnpm: versions.pnpm }, packageManager: `pnpm@${versions.pnpm}`, devDependencies: { lefthook: versions.lefthook } };
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(directory, '.node-version'), versions.node);
  fs.writeFileSync(path.join(directory, '.go-version'), versions.go);
  const consumer = path.join(directory, 'workspace/web');
  fs.mkdirSync(path.join(consumer, '.git'), { recursive: true });
  fs.writeFileSync(path.join(consumer, '.node-version'), '22.0.0');
  validate(directory);
  assert.throws(() => toolchains(directory), /node-version/);
  assert.equal(fs.readFileSync(path.join(consumer, '.node-version'), 'utf8'), '22.0.0');
});

test('source records accept official checkout URLs but reject a different repository or dirty candidate', async t => {
  const { snapshot } = await import('./workspace.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-source-record-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const checkout = path.join(directory, 'workspace/platform');
  fs.mkdirSync(checkout, { recursive: true });
  fs.writeFileSync(path.join(directory, 'mani.yaml'), 'projects:\n  platform:\n    path: workspace/platform\n    url: https://github.com/StuHelper/stuhelper-platform.git\n');
  const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  fs.writeFileSync(path.join(checkout, 'source.txt'), 'source\n'); git('add', '.'); git('commit', '-qm', 'fixture');
  git('remote', 'add', 'origin', 'https://github.com/StuHelper/stuhelper-platform');
  assert.equal(snapshot(directory, true).projects.platform.revision, git('rev-parse', 'HEAD'));
  const locked = JSON.parse(fs.readFileSync(path.join(directory, 'workspace.lock.json')));
  locked.projects.platform.tag = 'v0.2.0';
  fs.writeFileSync(path.join(directory, 'workspace.lock.json'), JSON.stringify(locked));
  assert.equal(snapshot(directory).projects.platform.tag, 'v0.2.0');
  locked.projects.platform.revision = 'b'.repeat(40);
  fs.writeFileSync(path.join(directory, 'workspace.lock.json'), JSON.stringify(locked));
  assert.equal(snapshot(directory).projects.platform.tag, undefined);
  git('remote', 'set-url', 'origin', 'git@github.com:StuHelper/stuhelper-platform.git');
  snapshot(directory, true);
  git('remote', 'set-url', 'origin', 'https://github.com/other/stuhelper-platform.git');
  assert.throws(() => snapshot(directory), /Unexpected origin/);
  git('remote', 'set-url', 'origin', 'https://github.com/StuHelper/stuhelper-platform');
  fs.writeFileSync(path.join(checkout, 'source.txt'), 'uncommitted\n');
  assert.throws(() => snapshot(directory, true), /Commit candidate changes/);
});

test('contract provenance retrieves the declared historical commit from a fresh checkout without switching it', async t => {
  const { providerSource } = await import('./workspace.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-provider-history-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const origin = path.join(directory, 'origin'); fs.mkdirSync(origin);
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  git(origin, 'init', '-b', 'develop', '-q'); git(origin, 'config', 'user.name', 'Fixture'); git(origin, 'config', 'user.email', 'fixture@example.test');
  fs.mkdirSync(path.join(origin, 'contracts'));
  fs.writeFileSync(path.join(origin, 'contracts/api.yaml'), 'version: old\n'); git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'original');
  const declared = git(origin, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(origin, 'contracts/api.yaml'), 'version: current\n'); git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'current');
  const current = git(origin, 'rev-parse', 'HEAD'); const checkout = path.join(directory, 'checkout');
  git(directory, 'clone', '--depth', '1', `file://${origin}`, checkout);
  assert.throws(() => git(checkout, 'cat-file', '-e', `${declared}^{commit}`));
  assert.equal(providerSource(checkout, declared, 'contracts/api.yaml'), 'version: old\n');
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), current);
  assert.equal(git(checkout, 'status', '--porcelain'), '');
});

test('academic snapshots reject forged digests, provider revisions and missing mappings', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-academic-contract-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'contracts'));
  fs.mkdirSync(path.join(directory, 'src/api'), { recursive: true });
  const contract = JSON.stringify({ openapi: '3.1.0', info: { version: '0.1.0' } });
  const generated = 'export interface paths {}';
  fs.writeFileSync(path.join(directory, 'contracts/catalog.openapi.json'), contract);
  fs.writeFileSync(path.join(directory, 'src/api/catalog.gen.ts'), generated);
  const source = { repository: 'StuHelper/stuhelper-catalog', revision: 'a'.repeat(40), version: '0.1.0', files: { 'contracts/catalog.openapi.json': 'contracts/catalog.openapi.json', 'sdk/catalog.gen.ts': 'src/api/catalog.gen.ts' }, sha256: { 'contracts/catalog.openapi.json': digest(contract), 'src/api/catalog.gen.ts': digest(generated) } };
  const provider = { name: 'catalog' }, client = { directory };
  const load = (revision, filename) => { assert.equal(revision, source.revision); return filename.startsWith('contracts/') ? contract : generated; };
  verifyAcademicSource(provider, client, source, load);
  assert.throws(() => verifyAcademicSource(provider, client, { ...source, files: {} }, load));
  assert.throws(() => verifyAcademicSource(provider, client, { ...source, revision: 'branch' }, load));
  assert.throws(() => verifyAcademicSource(provider, client, { ...source, sha256: {} }, load), /digest/);
  assert.throws(() => verifyAcademicSource(provider, client, source, () => 'different source'), /Snapshot differs/);
  const adminGenerated = 'apps/web-antd/src/api/catalog.gen.ts';
  fs.mkdirSync(path.dirname(path.join(directory, adminGenerated)), { recursive: true });
  fs.writeFileSync(path.join(directory, adminGenerated), generated);
  const adminSource = { ...source, files: { ...source.files, 'sdk/catalog.gen.ts': adminGenerated }, sha256: { 'contracts/catalog.openapi.json': digest(contract), [adminGenerated]: digest(generated) } };
  verifyAcademicSource(provider, { ...client, name: 'admin' }, adminSource, load);
  assert.throws(() => verifyAcademicSource(provider, { ...client, name: 'admin' }, source, load));
});


test('scenario verification obeys the explicit integration checkout scope', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-scope-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'spec.md'), '| MOD-01 | public |\n| MOD-02 | private |\n');
  fs.mkdirSync(path.join(directory, 'public'));
  fs.writeFileSync(path.join(directory, 'public', 'module_test.go'), 'func TestPublic(t *testing.T) {}');
  const definitions = [{ id: 'platform', repository: 'StuHelper/stuhelper-platform', specifications: ['spec.md'], scenario_tests: {'MOD-01':['module_test.go#TestPublic']} }, {id:'identity',repository:'StuHelper/stuhelper-backend',specifications:['spec.md'],scenario_tests:{'MOD-02':['private_test.go#TestPrivate']}}];
  const records = ['platform','backend'].map(name => ({name,url:`https://github.com/StuHelper/stuhelper-${name}.git`,directory:path.join(directory,name==='platform'?'public':'missing-private')}));
  assert.doesNotThrow(() => verifyWorkspaceScenarios(directory, definitions, records, ['platform']));
  assert.throws(() => verifyWorkspaceScenarios(directory, definitions, records), /ENOENT|Missing scenario test/);
  assert.throws(() => verifyWorkspaceScenarios(directory, definitions, records, ['typo']), /Unknown scenario checkout/);
  fs.rmSync(path.join(directory,'public','module_test.go'));
  assert.throws(() => verifyWorkspaceScenarios(directory, definitions, records, ['platform']), /ENOENT|Missing scenario test/);
});


test('CLI accepts an explicit contract scope without relaxing other commands', () => {
  assert.deepEqual(parseCommand(['contracts','--scope=platform,web,admin']), {command:'contracts',scope:['platform','web','admin'],write:false});
  assert.equal(parseCommand(['snapshot','--write']).write,true);
  for (const args of [['contracts','--write'],['contracts','--scope='],['validate','--scope=platform'],['snapshot','--scope=platform'],['contracts','--scope=platform','extra']]) assert.throws(()=>parseCommand(args));
});


test('runtime module declarations reject library kinds and mismatched capability dependencies', async () => {
  const {verifyRuntimeDescriptor}=await import('./workspace.mjs');
  const definition={id:'catalog',api:1,required:['platform'],optional:['identity'],capabilities:['catalog.read'],capability_requires:{'catalog.read':['identity']}};
  const manifest={id:'catalog',kind:'module',api:1,requires:[{id:'platform',api:1}],optional:[{id:'identity',api:1}],capabilities:['catalog.read'],capability_requires:{'catalog.read':[{id:'identity',api:1}]}};
  verifyRuntimeDescriptor(definition,manifest);
  assert.throws(()=>verifyRuntimeDescriptor(definition,{...manifest,kind:'library'}),/runtime module/);
  assert.throws(()=>verifyRuntimeDescriptor(definition,{...manifest,requires:[]}),/Required dependencies/);
  assert.throws(()=>verifyRuntimeDescriptor(definition,{...manifest,capability_requires:{}}),/Capability dependencies/);
});


test('locale policies retain shared rules and each consumer exceptions across independent releases', () => {
  const old = { default: 'zh-CN', default_time_zone: 'Asia/Shanghai', languages: { 'zh-CN': { direction: 'ltr' }, 'ar-EG': { direction: 'rtl' } }, same_text_exceptions: { web: { languages: {} }, admin: { shared: { brand: { value: 'StuHelper', reason: 'brand' } } } } };
  const current = structuredClone(old);
  current.same_text_exceptions.web.languages['fr-FR'] = { 'nav.campus': { value: 'Campus', reason: 'French word' } };
  verifyLocalePolicy(old, current, 'admin');
  verifyLocalePolicy(current, current, 'web');
  assert.throws(() => verifyLocalePolicy(old, current, 'web'), /locale exceptions/);
  for (const field of ['default', 'default_time_zone', 'languages']) {
    const changed = structuredClone(current);
    changed[field] = field === 'languages' ? { 'ar-EG': { direction: 'ltr' } } : 'changed';
    assert.throws(() => verifyLocalePolicy(changed, current, 'web'), /shared locale policy/);
  }
  const changed = structuredClone(old);
  changed.same_text_exceptions.admin.shared.brand.value = 'unexpected';
  assert.throws(() => verifyLocalePolicy(changed, current, 'admin'), /locale exceptions/);
  assert.throws(() => verifyLocalePolicy(old, current, 'unknown'), /Unknown locale policy application/);
});

test('dynamic client contract gate verifies all declared modules, respects scope, and rejects missing sources', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-dynamic-contracts-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const clientDir = path.join(directory, 'web');
  const platformDir = path.join(directory, 'platform');
  const notifDir = path.join(directory, 'notifications');
  const contribDir = path.join(directory, 'storage-contribution');
  fs.mkdirSync(path.join(clientDir, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(clientDir, 'src/api'), { recursive: true });
  fs.mkdirSync(path.join(platformDir, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(notifDir, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(contribDir, 'contracts'), { recursive: true });

  const rev = 'c'.repeat(40);
  const platformYaml = 'openapi: 3.1.0\ninfo:\n  version: 0.2.0\n';
  fs.writeFileSync(path.join(platformDir, 'contracts/platform.openapi.yaml'), platformYaml);
  fs.writeFileSync(path.join(clientDir, 'contracts/platform.openapi.yaml'), platformYaml);
  fs.writeFileSync(path.join(clientDir, 'src/api/platform.gen.ts'), 'export {};\n');
  fs.writeFileSync(path.join(clientDir, 'contracts/client-cases.json'), '{}\n');
  fs.writeFileSync(path.join(clientDir, 'contracts/platform.source.json'), JSON.stringify({
    repository: 'StuHelper/stuhelper-platform',
    revision: rev,
    version: '0.2.0',
    sha256: digest(platformYaml),
    files: {
      'contracts/platform.openapi.yaml': 'contracts/platform.openapi.yaml',
      'sdk/platform.gen.ts': 'src/api/platform.gen.ts',
      'contracts/client-cases.json': 'contracts/client-cases.json',
    },
  }));

  const notifJson = JSON.stringify({ openapi: '3.1.0', info: { version: '0.3.1' } });
  const notifSdk = 'export interface NotificationPaths {}\n';
  fs.writeFileSync(path.join(notifDir, 'contracts/notifications.openapi.json'), notifJson);
  fs.writeFileSync(path.join(clientDir, 'contracts/notifications.openapi.json'), notifJson);
  fs.writeFileSync(path.join(clientDir, 'src/api/notifications.gen.ts'), notifSdk);
  fs.writeFileSync(path.join(clientDir, 'contracts/notifications.source.json'), JSON.stringify({
    repository: 'StuHelper/stuhelper-notifications',
    revision: rev,
    version: '0.3.1',
    files: {
      'contracts/notifications.openapi.json': 'contracts/notifications.openapi.json',
      'sdk/notifications.gen.ts': 'src/api/notifications.gen.ts',
    },
    sha256: {
      'contracts/notifications.openapi.json': digest(notifJson),
      'src/api/notifications.gen.ts': digest(notifSdk),
    },
  }));

  const contribJson = JSON.stringify({ openapi: '3.1.0', info: { version: '0.1.0' } });
  const contribSdk = 'export interface ContribPaths {}\n';
  const contribBrowser = 'export const client = true;\n';
  fs.writeFileSync(path.join(contribDir, 'contracts/contribution.openapi.json'), contribJson);
  fs.writeFileSync(path.join(clientDir, 'contracts/contribution.openapi.json'), contribJson);
  fs.writeFileSync(path.join(clientDir, 'src/api/contribution.gen.ts'), contribSdk);
  fs.writeFileSync(path.join(clientDir, 'src/api/contribution.ts'), contribBrowser);
  fs.writeFileSync(path.join(clientDir, 'contracts/contribution.source.json'), JSON.stringify({
    repository: 'StuHelper/stuhelper-storage-contribution',
    revision: rev,
    version: '0.1.0',
    sha256: digest(contribJson),
    browser_sha256: digest(contribBrowser),
    files: {
      'contracts/contribution.openapi.json': 'contracts/contribution.openapi.json',
      'sdk/contribution.gen.ts': 'src/api/contribution.gen.ts',
      'sdk/browser.ts': 'src/api/contribution.ts',
    },
  }));

  const providerBlobs = new Map([
    [`${platformDir}:contracts/platform.openapi.yaml`, platformYaml],
    [`${platformDir}:sdk/platform.gen.ts`, 'export {};\n'],
    [`${platformDir}:contracts/client-cases.json`, '{}\n'],
    [`${notifDir}:contracts/notifications.openapi.json`, notifJson],
    [`${notifDir}:sdk/notifications.gen.ts`, notifSdk],
    [`${contribDir}:contracts/contribution.openapi.json`, contribJson],
    [`${contribDir}:sdk/contribution.gen.ts`, contribSdk],
    [`${contribDir}:sdk/browser.ts`, contribBrowser],
  ]);

  const records = [
    { name: 'platform', url: 'https://github.com/StuHelper/stuhelper-platform.git', directory: platformDir },
    { name: 'notifications', url: 'https://github.com/StuHelper/stuhelper-notifications.git', directory: notifDir },
    { name: 'storage-contribution', url: 'https://github.com/StuHelper/stuhelper-storage-contribution.git', directory: contribDir },
    { name: 'web', url: 'https://github.com/StuHelper/stuhelper-web.git', directory: clientDir },
  ];
  const architecture = {
    modules: [
      { id: 'platform', repository: 'StuHelper/stuhelper-platform' },
      { id: 'notifications', repository: 'StuHelper/stuhelper-notifications' },
      { id: 'storage-contribution', repository: 'StuHelper/stuhelper-storage-contribution' },
    ],
    applications: [{ id: 'web', optional: ['notifications', 'storage-contribution'] }],
  };
  const load = (dir, _rev, file) => {
    const key = `${dir}:${file}`;
    assert(providerBlobs.has(key), `Unexpected provider read: ${key}`);
    return providerBlobs.get(key);
  };

  verifyClientContracts(records, architecture, { name: 'web', directory: clientDir }, undefined, load, () => {});
  verifyContractSource({ name: 'notifications' }, { name: 'web', directory: clientDir }, 'notifications', JSON.parse(fs.readFileSync(path.join(clientDir, 'contracts/notifications.source.json'), 'utf8')), (_r, f) => load(notifDir, _r, f));

  // Scoped run does not read unscoped provider directories, while still requiring .source.json files to exist.
  verifyClientContracts(
    records,
    architecture,
    { name: 'web', directory: clientDir },
    ['platform', 'web'],
    (dir, _rev, file) => {
      assert.equal(dir, platformDir, 'Should not read unscoped provider');
      return load(dir, _rev, file);
    },
    () => {},
  );

  // Removing a declared module's .source.json fails immediately instead of silently skipping.
  fs.rmSync(path.join(clientDir, 'contracts/notifications.source.json'));
  assert.throws(
    () => verifyClientContracts(records, architecture, { name: 'web', directory: clientDir }, ['platform', 'web'], load, () => {}),
    /Missing client contract source/,
  );
});

test('toolchains synchronize playwright, stuhelper-tooling tags, catalog entries, and strict go directives', async t => {
  const { toolchains, validate } = await import('./workspace.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stuhelper-toolchains-sync-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'architecture'));
  fs.mkdirSync(path.join(directory, '.github/workflows'), { recursive: true });
  const versions = { node: '24.22.1', go: '1.27.3', pnpm: '10.33.4', actionlint: '1.7.12', lefthook: '2.2.2', playwright: '1.64.1', tooling: 'v0.1.9' };
  fs.writeFileSync(path.join(directory, 'architecture/toolchains.yaml'), YAML.stringify(versions));
  fs.writeFileSync(path.join(directory, 'mani.yaml'), YAML.stringify({
    sync_remotes: false,
    sync_gitignore: false,
    remove_orphaned_worktrees: false,
    specs: { default: { ignore_errors: false, ignore_non_existing: false } },
    projects: {
      admin: { path: 'workspace/admin', url: 'https://github.com/StuHelper/stuhelper-admin.git', branch: 'develop', tags: ['frontend', 'code', 'public'] },
      ops: { path: 'workspace/ops', url: 'https://github.com/StuHelper/stuhelper-ops.git', branch: 'develop', tags: ['documents', 'private'] },
      tooling: { path: 'workspace/tooling', url: 'https://github.com/StuHelper/stuhelper-tooling.git', branch: 'develop', tags: ['tooling', 'code', 'public'] },
    },
  }));
  fs.writeFileSync(path.join(directory, 'architecture/modules.yaml'), YAML.stringify({
    schema_version: 2,
    modules: [],
    applications: [{ id: 'admin', repository: 'StuHelper/stuhelper-admin', visibility: 'public' }],
    operations: [{ id: 'ops', repository: 'StuHelper/stuhelper-ops', visibility: 'private' }],
  }));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    engines: { node: '22.0.0', pnpm: '9.0.0' },
    packageManager: 'pnpm@9.0.0',
    devDependencies: { '@playwright/test': '1.60.0', '@stuhelper/engineering-tools': 'git+https://github.com/StuHelper/stuhelper-tooling.git#v0.1.4', lefthook: '2.0.0' },
  }));
  fs.writeFileSync(path.join(directory, '.github/workflows/checks.yml'), 'uses: StuHelper/stuhelper-tooling/.github/workflows/node-checks.yml@v0.1.4\n');

  const adminDir = path.join(directory, 'workspace/admin');
  fs.mkdirSync(path.join(adminDir, '.git'), { recursive: true });
  fs.writeFileSync(path.join(adminDir, 'package.json'), JSON.stringify({
    engines: { node: '24.22.1', pnpm: '10.33.4' },
    packageManager: 'pnpm@10.33.4',
    devDependencies: { playwright: 'catalog:', '@stuhelper/engineering-tools': 'git+https://github.com/StuHelper/stuhelper-tooling.git#v0.1.0', lefthook: '2.2.2' },
  }));
  fs.writeFileSync(path.join(adminDir, 'pnpm-workspace.yaml'), 'catalog:\n  playwright: 1.60.0\n');
  fs.writeFileSync(path.join(adminDir, 'go.mod'), 'module example.test/admin\n// go 1.27.3\ngo 1.26.0\n');

  toolchains(directory, true, true);
  validate(directory);
  assert.match(fs.readFileSync(path.join(directory, '.github/workflows/checks.yml'), 'utf8'), /@v0\.1\.9/);
  assert.match(fs.readFileSync(path.join(adminDir, 'pnpm-workspace.yaml'), 'utf8'), /playwright: 1\.64\.1/);
  assert.match(fs.readFileSync(path.join(adminDir, 'go.mod'), 'utf8'), /^go 1\.27\.3$/m);

  fs.writeFileSync(path.join(adminDir, 'go.mod'), 'module example.test/admin\n// go 1.27.3\ngo 1.26.0\n');
  assert.throws(() => toolchains(directory, false, true), /go\.mod/);
});
