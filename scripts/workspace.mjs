import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { scenarioTitles } from './scenario-titles.mjs';
import { readYaml, root, verifyScenarioIds } from './architecture.mjs';

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }).trim();
export const projects = (directory = root) => Object.entries(readYaml(path.join(directory, 'mani.yaml')).projects).map(([name, value]) => ({ name, ...value, directory: path.resolve(directory, value.path) }));

function compareSemverTag(left, right) {
  const parse = value => {
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '');
    assert(match, `Invalid semver tag: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function validate(directory = root) {
  const config = readYaml(path.join(directory, 'mani.yaml'));
  for (const flag of ['sync_remotes', 'sync_gitignore', 'remove_orphaned_worktrees']) assert.equal(config[flag], false, flag);
  assert.equal(config.specs.default.ignore_errors, false);
  assert.equal(config.specs.default.ignore_non_existing, false);
  const modules = readYaml(path.join(directory, 'architecture/modules.yaml'));
  const visibilityByRepo = new Map();
  for (const item of [
    ...(modules.modules ?? []).filter(module => module.implementation !== 'not-implemented' && !module.in_application),
    ...(modules.applications ?? []),
    ...(modules.operations ?? []),
  ]) {
    visibilityByRepo.set(item.repository, item.visibility);
  }
  const fullManifest = modules.schema_version === 2;
  if (fullManifest) visibilityByRepo.set('StuHelper/stuhelper-tooling', 'public');
  const allowedRepositories = new Set([
    ...(modules.modules ?? []).map(item => item.repository),
    ...(modules.applications ?? []).map(item => item.repository),
    ...(modules.operations ?? []).map(item => item.repository),
    'StuHelper/stuhelper-tooling',
  ]);
  const configured = new Set();
  for (const project of projects(directory)) {
    assert.match(project.name, /^[a-z][a-z-]*$/);
    const repository = `StuHelper/stuhelper-${project.name}`;
    assert.equal(project.url, `https://github.com/${repository}.git`);
    assert.equal(project.path, `workspace/${project.name}`);
    assert.equal(project.branch, 'develop');
    assert(allowedRepositories.has(repository), `Missing repository declaration: ${project.name}`);
    assert(!project.worktrees, 'Use native git worktree for task checkouts');
    const expectedVisibility = visibilityByRepo.get(repository);
    if (fullManifest || (Array.isArray(project.tags) && expectedVisibility)) {
      const visibilities = (project.tags ?? []).filter(tag => ['public', 'private'].includes(tag));
      assert.deepEqual(visibilities, [expectedVisibility], `Visibility tag mismatch: ${project.name}`);
    }
    configured.add(repository);
  }
  for (const repository of visibilityByRepo.keys()) {
    assert(configured.has(repository), `Missing mani project for declared repository: ${repository}`);
  }
  toolchains(directory, false, false);
}

// A release can update one application's translation exceptions independently.
// Shared language rules and the consuming application's own exceptions stay strict.
export function verifyLocalePolicy(actual, expected, application) {
  assert(['web', 'admin'].includes(application), 'Unknown locale policy application');
  const { same_text_exceptions: actualExceptions, ...actualShared } = actual;
  const { same_text_exceptions: expectedExceptions, ...expectedShared } = expected;
  assert.deepEqual(actualShared, expectedShared, `${application}: shared locale policy`);
  assert(expectedExceptions?.[application], `${application}: missing central locale exceptions`);
  assert.deepEqual(actualExceptions?.[application], expectedExceptions[application], `${application}: locale exceptions`);
}

function syncPlaywrightVersion(location, pkg, version, write) {
  if (!version || !pkg.devDependencies) return false;
  let changed = false;
  for (const dependency of ['@playwright/test', 'playwright']) {
    if (pkg.devDependencies[dependency] === undefined) continue;
    if (pkg.devDependencies[dependency] === 'catalog:') {
      const workspaceFile = path.join(location, 'pnpm-workspace.yaml');
      assert(fs.existsSync(workspaceFile), `${location}: missing pnpm-workspace.yaml for catalog ${dependency}`);
      const doc = YAML.parseDocument(fs.readFileSync(workspaceFile, 'utf8'));
      if (write) {
        doc.setIn(['catalog', dependency], version);
        fs.writeFileSync(workspaceFile, doc.toString({ lineWidth: 0 }));
      }
      assert.equal(String(doc.getIn(['catalog', dependency])), version, `${location}: catalog ${dependency}`);
    } else {
      if (write) {
        pkg.devDependencies[dependency] = version;
        changed = true;
      }
      assert.equal(pkg.devDependencies[dependency], version, `${location}: ${dependency}`);
    }
  }
  return changed;
}

function syncToolingVersion(location, isRoot, pkg, version, write) {
  if (!version) return false;
  const expectedDependency = `git+https://github.com/StuHelper/stuhelper-tooling.git#${version}`;
  let changed = false;
  if (pkg.devDependencies?.['@stuhelper/engineering-tools'] !== undefined) {
    if (write) {
      pkg.devDependencies['@stuhelper/engineering-tools'] = expectedDependency;
      changed = true;
    }
    if (isRoot || write) {
      assert.equal(pkg.devDependencies['@stuhelper/engineering-tools'], expectedDependency, `${location}: @stuhelper/engineering-tools`);
    } else {
      const match = /^git\+https:\/\/github\.com\/StuHelper\/stuhelper-tooling\.git#(v\d+\.\d+\.\d+)$/.exec(pkg.devDependencies['@stuhelper/engineering-tools']);
      assert(match && compareSemverTag(match[1], version) <= 0, `${location}: invalid @stuhelper/engineering-tools (${pkg.devDependencies['@stuhelper/engineering-tools']})`);
    }
  }
  const workflowsDir = path.join(location, '.github/workflows');
  if (fs.existsSync(workflowsDir)) {
    for (const entry of fs.readdirSync(workflowsDir).filter(file => /\.ya?ml$/.test(file))) {
      const workflowFile = path.join(workflowsDir, entry);
      let content = fs.readFileSync(workflowFile, 'utf8');
      if (write) {
        const updated = content.replace(/(StuHelper\/stuhelper-tooling\/[^\s@]+@)v\d+\.\d+\.\d+/g, `$1${version}`);
        if (updated !== content) {
          fs.writeFileSync(workflowFile, updated);
          content = updated;
        }
      }
      for (const match of content.matchAll(/StuHelper\/stuhelper-tooling\/[^\s@]+@([^\s]+)/g)) {
        if (isRoot || write) assert.equal(match[1], version, `${workflowFile}: stuhelper-tooling`);
        else assert(compareSemverTag(match[1], version) <= 0, `${workflowFile}: stuhelper-tooling tag exceeds declared ${version}`);
      }
    }
  }
  return changed;
}

export function toolchains(directory = root, write = false, includeCheckouts = true) {
  const versions = readYaml(path.join(directory, 'architecture/toolchains.yaml'));
  assert(Number.isSafeInteger(versions.postgresql) && versions.postgresql > 0, 'PostgreSQL must declare a positive integer major version');
  const directories = [directory, ...(includeCheckouts ? projects(directory).map(project => project.directory).filter(location => fs.existsSync(path.join(location, '.git'))) : [])];
  for (const location of directories) {
    const isRoot = path.resolve(location) === path.resolve(directory);
    for (const [file, version] of [['.node-version', versions.node], ['.go-version', versions.go]]) {
      if (write) fs.writeFileSync(path.join(location, file), `${version}\n`);
      assert.equal(fs.readFileSync(path.join(location, file), 'utf8').trim(), version, `${location}/${file}`);
    }
    const pkgFile = path.join(location, 'package.json');
    assert(fs.existsSync(pkgFile), `${location}: missing package.json`);
    const pkg = readJSON(pkgFile);
    if (write) {
      pkg.engines = { ...pkg.engines, node: versions.node, pnpm: versions.pnpm };
      pkg.packageManager = `pnpm@${versions.pnpm}`;
      pkg.devDependencies = { ...pkg.devDependencies, lefthook: versions.lefthook };
    }
    const playwrightChanged = syncPlaywrightVersion(location, pkg, versions.playwright, write);
    const toolingChanged = syncToolingVersion(location, isRoot, pkg, versions.tooling, write);
    if (write || playwrightChanged || toolingChanged) {
      if (write) fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    }
    assert.equal(pkg.engines?.node, versions.node, `${location}: node`);
    assert.equal(pkg.engines?.pnpm, versions.pnpm, `${location}: pnpm`);
    assert.equal(pkg.packageManager, `pnpm@${versions.pnpm}`, `${location}: packageManager`);
    assert.equal(pkg.devDependencies?.lefthook, versions.lefthook, `${location}: lefthook`);
    const postgresScript = path.join(location, 'actions/setup/postgres.sh');
    if (fs.existsSync(postgresScript)) {
      const source = fs.readFileSync(postgresScript, 'utf8');
      const major = /^pg_major=(\d+)$/m;
      assert(major.test(source), `${postgresScript}: missing PostgreSQL major assignment`);
      if (write) fs.writeFileSync(postgresScript, source.replace(major, `pg_major=${versions.postgresql}`));
      assert.equal(Number(fs.readFileSync(postgresScript, 'utf8').match(major)?.[1]), versions.postgresql, `${postgresScript}: PostgreSQL major`);
    }
    const actionlintScript = path.join(location, 'actions/setup/actionlint.sh');
    const setupFile = path.join(location, 'actions/setup/action.yml');
    if (fs.existsSync(actionlintScript)) {
      if (write) fs.writeFileSync(actionlintScript, fs.readFileSync(actionlintScript, 'utf8').replace(/^version=\S+$/m, `version=${versions.actionlint}`));
      assert.equal(fs.readFileSync(actionlintScript, 'utf8').match(/^version=(\S+)$/m)?.[1], versions.actionlint, `${location}: actionlint`);
    } else if (fs.existsSync(setupFile)) {
      const setup = YAML.parseDocument(fs.readFileSync(setupFile, 'utf8'));
      const steps = setup.getIn(['runs', 'steps']);
      const index = steps.items.findIndex(step => step.getIn(['env', 'ACTIONLINT_VERSION']) !== undefined);
      assert(index >= 0, 'Shared setup must declare the workflow linter version');
      const key = ['runs', 'steps', index, 'env', 'ACTIONLINT_VERSION'];
      if (write) { setup.setIn(key, versions.actionlint); fs.writeFileSync(setupFile, setup.toString({ lineWidth: 0 })); }
      assert.equal(setup.getIn(key), versions.actionlint, `${location}: actionlint`);
    }
    const goMod = path.join(location, 'go.mod');
    if (fs.existsSync(goMod)) {
      if (write) fs.writeFileSync(goMod, fs.readFileSync(goMod, 'utf8').replace(/^go\s+\S+\s*$/m, `go ${versions.go}`));
      assert.equal(fs.readFileSync(goMod, 'utf8').match(/^go\s+(\S+)\s*$/m)?.[1], versions.go, `${location}: go.mod`);
    }
    const policy = path.join(location, 'locale-policy.yaml');
    if (fs.existsSync(policy)) {
      const source = fs.readFileSync(path.join(directory, 'architecture/locales.yaml'));
      if (write) {
        fs.writeFileSync(policy, source);
        execFileSync('pnpm', ['exec', 'stuhelper-check', 'locale-policy', '--write'], { cwd: location, stdio: 'inherit', timeout: 30_000 });
      }
      const application = projects(directory).find(project => project.directory === location)?.name;
      verifyLocalePolicy(readYaml(policy), YAML.parse(source.toString()), application);
    }
  }
  console.log(`PASS: toolchains agree in ${directories.length} checked-out repositories`);
}

export function verifySource(provider, client, source, loadSource) {
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  assert.equal(source.repository, provider.url.replace('https://github.com/', '').replace(/\.git$/, ''));
  const generated = client.name === 'admin' ? 'apps/web-antd/src/api/platform.gen.ts' : 'src/api/platform.gen.ts';
  assert.deepEqual(source.files, {
    'contracts/platform.openapi.yaml': 'contracts/platform.openapi.yaml',
    'sdk/platform.gen.ts': generated,
    'contracts/client-cases.json': 'contracts/client-cases.json',
  }, 'Source record must cover the contract, generated types and shared cases');
  for (const [providerFile, clientFile] of Object.entries(source.files)) {
    for (const filename of [providerFile, clientFile]) assert(!path.isAbsolute(filename) && !filename.split('/').includes('..'), 'Invalid snapshot path');
    const expected = loadSource(source.revision, providerFile);
    assert.equal(fs.readFileSync(path.join(client.directory, clientFile), 'utf8'), expected, `Snapshot differs from declared provider revision: ${client.name}/${clientFile}`);
  }
  const contract = fs.readFileSync(path.join(client.directory, 'contracts/platform.openapi.yaml'));
  assert.equal(hash(contract), source.sha256, 'Contract digest differs from source record');
  assert.equal(YAML.parse(contract.toString()).info.version, source.version, 'Contract version differs from source record');
}

export function verifyScenarios(directory, definition, checkout) {
  const titles = new Map();
  verifyScenarioIds(directory, definition);
  for (const [scenario, tests] of Object.entries(definition.scenario_tests ?? {})) {
    assert(tests.length, `No tests for implemented scenario: ${scenario}`);
    for (const reference of tests) {
      const separator = reference.indexOf('#');
      assert(separator > 0 && separator < reference.length - 1, `Invalid scenario reference: ${scenario}/${reference}`);
      const file = reference.slice(0, separator);
      const name = reference.slice(separator + 1);
      assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
      assert(/(?:_test\.go|\.(?:test|spec)\.(?:mjs|[jt]sx?))$/.test(file), `Invalid test file: ${file}`);
      if (!titles.has(file)) titles.set(file, scenarioTitles(file, fs.readFileSync(path.join(checkout, file), 'utf8')));
      assert(titles.get(file).has(name), `Missing scenario test: ${scenario}/${reference}`);
    }
  }
}
export function verifySnapshotPairs(client) {
  const files = fs.readdirSync(path.join(client.directory, 'contracts'));
  const records = new Set(files.filter(file => file.endsWith('.source.json')));
  for (const file of files.filter(file => /\.openapi\.(?:json|ya?ml)$/.test(file))) {
    const source = file.replace(/\.openapi\.[^.]+$/, '.source.json');
    assert(records.delete(source), `${client.name}/${file}: missing or ambiguous ${source}`);
  }
  assert.equal(records.size, 0, `${client.name}: no OpenAPI snapshot for ${[...records].join(', ')}`);
}

export function verifyClientScenarios(directory, definition, client) {
  assert(definition, `Missing central application: ${client.name}`);
  const manifest = readJSON(path.join(client.directory, 'module.json'));
  assert.equal(manifest.id, definition.id);
  assert(manifest.scenario_tests && Object.keys(manifest.scenario_tests).length, `Missing client scenarios: ${client.name}`);
  verifyScenarios(directory, definition, client.directory);
  verifyScenarios(directory, { ...definition, scenario_tests: manifest.scenario_tests }, client.directory);
}

export function verifyAcademicSource(provider, client, source, loadSource) {
  const module = provider.name;
  assert.match(module, /^[a-z][a-z0-9-]*$/);
  assert.equal(source.repository, `StuHelper/stuhelper-${module}`);
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  const contract = `contracts/${module}.openapi.json`;
  const generated = client.name === 'admin' ? `apps/web-antd/src/api/${module}.gen.ts` : `src/api/${module}.gen.ts`;
  assert.deepEqual(source.files, { [contract]: contract, [`sdk/${module}.gen.ts`]: generated });
  for (const [providerFile, clientFile] of Object.entries(source.files)) {
    const content = fs.readFileSync(path.join(client.directory, clientFile), 'utf8');
    assert.equal(content, loadSource(source.revision, providerFile), `Snapshot differs from declared provider revision: ${module}/${clientFile}`);
    assert.equal(hash(content), source.sha256[clientFile], `Snapshot digest differs: ${clientFile}`);
  }
  assert.equal(readJSON(path.join(client.directory, contract)).info.version, source.version);
}

export function verifyContractSource(provider, client, sourceName, source, loadSource) {
  if (sourceName === 'platform') {
    verifySource(provider, client, source, loadSource);
    return { providerContract: 'contracts/platform.openapi.yaml', clientContract: 'contracts/platform.openapi.yaml' };
  }
  if (sourceName === provider.name && source.sha256 && typeof source.sha256 === 'object') {
    verifyAcademicSource(provider, client, source, loadSource);
    const contract = `contracts/${provider.name}.openapi.json`;
    return { providerContract: contract, clientContract: contract };
  }
  assert.equal(source.repository, `StuHelper/stuhelper-${provider.name}`);
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  const files = source.files ?? { [`contracts/${sourceName}.openapi.json`]: `contracts/${sourceName}.openapi.json` };
  const entries = Object.entries(files);
  assert(entries.length > 0, `Empty contract file mapping: ${client.name}/${sourceName}`);
  for (const [providerFile, clientFile] of entries) {
    for (const filename of [providerFile, clientFile]) assert(!path.isAbsolute(filename) && !filename.split('/').includes('..'), 'Invalid snapshot path');
    const content = fs.readFileSync(path.join(client.directory, clientFile), 'utf8');
    assert.equal(content, loadSource(source.revision, providerFile), `Snapshot differs from declared provider revision: ${provider.name}/${clientFile}`);
    if (source.sha256 && typeof source.sha256 === 'object') {
      assert.equal(hash(content), source.sha256[clientFile], `Snapshot digest differs: ${clientFile}`);
    }
  }
  if (source.browser_sha256) {
    const browserTarget = files['sdk/browser.ts'];
    assert(browserTarget, `Missing sdk/browser.ts mapping: ${client.name}/${sourceName}`);
    assert.equal(hash(fs.readFileSync(path.join(client.directory, browserTarget), 'utf8')), source.browser_sha256, `Browser SDK digest differs: ${browserTarget}`);
  }
  const contracts = entries.filter(([, clientFile]) => /\.openapi\.(?:json|ya?ml)$/.test(clientFile));
  assert.equal(contracts.length, 1, `Expected one OpenAPI contract in ${client.name}/${sourceName}`);
  const [providerContract, clientContract] = contracts[0];
  const rawContract = fs.readFileSync(path.join(client.directory, clientContract));
  if (typeof source.sha256 === 'string') assert.equal(hash(rawContract), source.sha256, `Contract digest differs: ${clientContract}`);
  assert.equal(YAML.parse(rawContract.toString('utf8')).info?.version, source.version, `Contract version differs: ${clientContract}`);
  return { providerContract, clientContract };
}

export function providerSource(checkout, revision, filename) {
  assert.match(revision, /^[0-9a-f]{40}$/);
  assert(!path.isAbsolute(filename) && !filename.split('/').includes('..'), 'Invalid snapshot path');
  try { git(checkout, 'cat-file', '-e', `${revision}^{commit}`); }
  catch {
    execFileSync('git', ['-C', checkout, 'fetch', '--no-tags', 'origin', revision], { stdio: 'inherit', timeout: 60_000, killSignal: 'SIGKILL' });
  }
  return execFileSync('git', ['-C', checkout, 'show', `${revision}:${filename}`], { encoding: 'utf8', timeout: 30_000 });
}

export function verifyClientContracts(records, architecture, client, scope, loadProviderSource = providerSource, checkBreaking = compareContracts) {
  const app = architecture.applications.find(item => item.id === client.name);
  assert(app, `Missing central application: ${client.name}`);
  const byId = new Map(architecture.modules.map(item => [item.id, item]));
  const expectedRepositories = new Set([
    'StuHelper/stuhelper-platform',
    ...(app.optional ?? []).map(id => {
      const module = byId.get(id);
      assert(module, `Unknown optional module in ${client.name}: ${id}`);
      return module.repository;
    }),
  ]);
  const contractsDir = path.join(client.directory, 'contracts');
  assert(fs.existsSync(contractsDir), `Missing contracts directory: ${client.name}`);
  const sourceFiles = fs.readdirSync(contractsDir).filter(file => file.endsWith('.source.json')).sort();
  const seenRepositories = new Set();
  for (const file of sourceFiles) {
    const sourceName = file.slice(0, -'.source.json'.length);
    const source = readJSON(path.join(contractsDir, file));
    assert(expectedRepositories.has(source.repository), `Undeclared contract dependency in ${client.name}: ${file} (${source.repository})`);
    seenRepositories.add(source.repository);
    const provider = records.find(project => project.url === `https://github.com/${source.repository}.git`);
    assert(provider, `Unknown contract provider: ${source.repository}`);
    if (scope && !scope.includes(provider.name)) continue;
    const { providerContract, clientContract } = verifyContractSource(
      provider,
      client,
      sourceName,
      source,
      (revision, filename) => loadProviderSource(provider.directory, revision, filename),
    );
    const prior = path.join(client.directory, clientContract);
    const current = path.join(provider.directory, providerContract);
    if (!fs.readFileSync(prior).equals(fs.readFileSync(current))) {
      checkBreaking(prior, current);
    }
  }
  for (const repository of expectedRepositories) {
    assert(seenRepositories.has(repository), `Missing client contract source in ${client.name}: ${repository}`);
  }
}

export function verifyWorkspaceScenarios(directory, definitions, records, scope) {
  if (scope) {
    assert(scope.length > 0 && new Set(scope).size === scope.length, 'Invalid scenario checkout scope');
    for (const name of scope) assert(records.some(project => project.name === name), `Unknown scenario checkout: ${name}`);
  }
  for (const definition of definitions.filter(module => module.scenario_tests)) {
    const project = records.find(project => project.url === `https://github.com/${definition.repository}.git`);
    assert(project, `Scenario provider checkout missing: ${definition.id}`);
    if (scope && !scope.includes(project.name)) continue;
    verifyScenarios(directory, definition, project.directory);
  }
}

export function verifyRuntimeDescriptor(definition, manifest) {
  assert(
    manifest.kind === 'module' || (manifest.kind === undefined && ['platform', 'campus-adapters'].includes(definition.id)),
    `Expected runtime module: ${definition.id}`,
  );
  assert.equal(manifest.id, definition.id);
  assert.equal(manifest.api, definition.api);
  assert.equal(Boolean(manifest.critical), Boolean(definition.critical), `Critical flag differs: ${definition.id}`);
  const dependencies = value => (value ?? []).map(v => typeof v === 'string' ? { id: v, api: 1 } : v).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(dependencies(manifest.requires), dependencies(definition.required), `Required dependencies differ: ${definition.id}`);
  assert.deepEqual(dependencies(manifest.optional), dependencies(definition.optional), `Optional dependencies differ: ${definition.id}`);
  assert.deepEqual([...(manifest.capabilities ?? [])].sort(), [...(definition.capabilities ?? [])].sort(), `Capabilities differ: ${definition.id}`);
  const capabilities = value => Object.fromEntries(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, deps]) => [key, dependencies(deps)]));
  assert.deepEqual(capabilities(manifest.capability_requires), capabilities(definition.capability_requires), `Capability dependencies differ: ${definition.id}`);
}

export function compareContracts(prior, current, binary = path.join(root, '.tools/bin/oasdiff')) {
  if (fs.readFileSync(prior).equals(fs.readFileSync(current))) return;
  assert(fs.existsSync(binary), 'Install the pinned oasdiff with make setup-contracts');
  execFileSync(binary, ['breaking', prior, current, '--allow-external-refs=false', '--fail-on', 'WARN'],
    { stdio: 'inherit', timeout: 60_000, killSignal: 'SIGKILL' });
}

export function contracts(directory = root, scope) {
  const records = projects(directory);
  const architecture = readYaml(path.join(directory, 'architecture/modules.yaml'));
  const definitions = architecture.modules;
  const scenarioDefinitions = [
    ...definitions,
    ...(architecture.applications ?? []).filter(app => !['web', 'admin'].includes(app.id)),
    ...(architecture.operations ?? []),
  ];
  verifyWorkspaceScenarios(directory, scenarioDefinitions, records, scope);
  for (const definition of definitions.filter(module => ['framework', 'in-progress'].includes(module.implementation) && !module.in_application)) {
    const project = records.find(item => item.url === `https://github.com/${definition.repository}.git`);
    assert(project, `Runtime module checkout missing: ${definition.id}`);
    if (scope && !scope.includes(project.name)) continue;
    verifyRuntimeDescriptor(definition, readYaml(path.join(project.directory, 'module.yaml')));
  }
  for (const client of records.filter(project => project.tags?.includes('frontend'))) {
    if (scope && !scope.includes(client.name)) continue;
    verifySnapshotPairs(client);
    verifyClientScenarios(directory, architecture.applications.find(app => app.id === client.name), client);
    verifyClientContracts(records, architecture, client, scope);
  }
  console.log('PASS: scenario mappings, client snapshot provenance and API compatibility');
}

export function snapshot(directory = root, write = false) {
  const record = { schema_version: 1, projects: {} };
  const lockPath = path.join(directory, 'workspace.lock.json');
  const locked = fs.existsSync(lockPath) ? readJSON(lockPath) : undefined;
  assert(!write || !locked?.release, 'Refusing to overwrite a release workspace.lock.json with local snapshot --write');
  for (const project of projects(directory).filter(project => fs.existsSync(path.join(project.directory, '.git')))) {
    assert.equal(fs.realpathSync(git(project.directory, 'rev-parse', '--show-toplevel')), fs.realpathSync(project.directory));
    const canonical = url => url.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '').toLowerCase();
    assert.equal(canonical(git(project.directory, 'remote', 'get-url', 'origin')), canonical(project.url), `Unexpected origin: ${project.name}`);
    const dirty = Boolean(git(project.directory, 'status', '--porcelain'));
    assert(!write || !dirty, `Commit candidate changes before recording ${project.name}`);
    const revision = git(project.directory, 'rev-parse', 'HEAD');
    const tag = locked?.projects?.[project.name]?.revision === revision && !dirty ? locked.projects[project.name].tag : undefined;
    record.projects[project.name] = { repository: project.url, revision, dirty, ...(tag ? { tag } : {}) };
  }
  const rendered = `${JSON.stringify(record, null, 2)}\n`;
  if (write) {
    for (const name of Object.keys(locked?.projects ?? {})) {
      assert(Object.hasOwn(record.projects, name), `Missing checkout for locked project: ${name}`);
    }
    fs.writeFileSync(lockPath, rendered);
  }
  console.log(rendered);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = Object.entries(record.projects).map(([name, value]) => `| ${name} | ${value.tag || '—'} | ${value.revision} | ${value.dirty} |`);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Tested source combination\n\n| Repository | Tag | Commit | Dirty |\n| --- | --- | --- | --- |\n${lines.join('\n')}\n`);
  }
  return record;
}

export function goWorkspace(directory = root) {
  const version = readYaml(path.join(directory, 'architecture/toolchains.yaml')).go;
  const modules = projects(directory).filter(project => fs.existsSync(path.join(project.directory, 'go.mod')));
  const filename = path.join(directory, 'go.work');
  if (fs.existsSync(filename)) {
    execFileSync('go', ['work', 'edit', `-go=${version}`], { cwd: directory, stdio: 'inherit', env: { ...process.env, GOWORK: filename }, timeout: 30_000 });
    execFileSync('go', ['work', 'use', ...modules.map(project => `./${project.path}`)], { cwd: directory, stdio: 'inherit', env: { ...process.env, GOWORK: filename }, timeout: 30_000 });
  } else fs.writeFileSync(filename, `go ${version}\n\nuse (\n${modules.map(project => `\t./${project.path}`).join('\n')}\n)\n`);
  console.log(`Created local go.work with ${modules.length} modules; formal builds use GOWORK=off`);
}

export function parseCommand(args) {
  const [command, flag, extra] = args;
  assert(!extra, 'Unexpected command argument');
  if (command === 'contracts') {
    assert(!flag || flag.startsWith('--scope='), 'Use contracts [--scope=project,...]');
    const scope = flag ? flag.slice(8).split(',') : undefined;
    assert(!scope || scope.every(name => /^[a-z][a-z-]*$/.test(name)), 'Invalid scenario checkout scope');
    return { command, scope, write: false };
  }
  assert(!flag || (['snapshot', 'toolchains'].includes(command) && flag === '--write'), 'Only snapshot and toolchains accept --write');
  return { command, write: flag === '--write' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, scope, write } = parseCommand(process.argv.slice(2));
    if (command === 'validate') validate();
    else if (command === 'toolchains') toolchains(root, write);
    else if (command === 'contracts') contracts(root, scope);
    else if (command === 'snapshot') snapshot(root, write);
    else if (command === 'go-work') goWorkspace();
    else throw new Error('Use validate, contracts, toolchains [--write], snapshot [--write], or go-work. Use Mani directly for repository tasks.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
