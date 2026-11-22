import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readYaml, root, validateModules, validateSpecifications } from './architecture.mjs';

const load = () => readYaml(path.join(root, 'architecture/modules.yaml'));
test('declared architecture and all specification owners are valid', () => {
  validateModules(load());
  validateSpecifications(load());
});

test('profiles declares favorites as an optional dependency for account closure', () => {
  const profiles = load().modules.find(module => module.id === 'profiles');
  assert.ok(profiles.optional.includes('favorites'));
});

for (const [name, mutate, message] of [
  ['adapter libraries do not claim runtime capabilities', modules => { modules.get('storage-bhpan').capabilities = ['storage-bhpan.runtime']; }, /runtime capabilities/],
  ['private implementation cannot become public', modules => { modules.get('verification').visibility = 'public'; }, /must remain private/],
  ['business candidates declare their implemented contract', modules => { modules.get('verification').contract_status = 'design-only'; }, /implemented contract/],
  ['business candidates declare an API version', modules => { delete modules.get('verification').api; }, /API version/],
  ['storage protocol implementation remains public', modules => { modules.get('storage-bhpan').visibility = 'private'; }, /must remain public/],
  ['repositories have one module owner', modules => { modules.get('reviews').repository = modules.get('catalog').repository; }, /Duplicate repository/],
  ['required dependency cycle fails', modules => { modules.get('platform').required = ['reviews']; }, /cycle/],
  ['unknown optional provider fails', modules => { modules.get('resources').optional.push('missing'); }, /Unknown dependency/],
  ['undeclared eligibility facts fail', modules => { modules.get('reviews').eligibility_facts.phone_bound = 'missing'; }, /Undeclared eligibility/],
  ['capability dependencies must be declared', modules => { modules.get('platform').capability_requires['platform.status'] = ['identity']; }, /Undeclared capability dependency/],
  ['same dependency cannot be required and optional', modules => { modules.get('reviews').optional.push('platform'); }, /Repeated dependency/],
  ['qq-binding implementation cannot become public', modules => { modules.get('qq-binding').visibility = 'public'; }, /must remain private/],
]) test(name, () => {
  const config = load();
  mutate(new Map(config.modules.map(module => [module.id, module])));
  assert.throws(() => validateModules(config), message);
});

test('a repository can host multiple logical modules within the same application', () => {
  const config = load();
  const identity = config.modules.find(module => module.id === 'identity');
  const sibling = {
    ...identity,
    id: 'hosted-module',
    interface_owner: 'hosted-module',
    capabilities: [],
  };
  config.modules.push(sibling);
  validateModules(config);

  sibling.visibility = 'public';
  assert.throws(() => validateModules(config), /Application module visibility mismatch/);
  sibling.visibility = 'private';

  delete sibling.in_application;
  assert.throws(() => validateModules(config), /Duplicate repository owner/);
});

test('applications and operations validate optional dependencies and private visibility', () => {
  const badOps = load();
  badOps.operations[0].visibility = 'public';
  assert.throws(() => validateModules(badOps), /ops must remain private/);

  const unknownAppDep = load();
  unknownAppDep.applications[0].optional.push('missing-module');
  assert.throws(() => validateModules(unknownAppDep), /Unknown dependency: backend\/missing-module/);

  const repeatedAppDep = load();
  repeatedAppDep.applications[1].optional.push('catalog');
  assert.throws(() => validateModules(repeatedAppDep), /Repeated dependency: web\/catalog/);

  const undeclaredAppCap = load();
  undeclaredAppCap.applications[2].capability_requires['notifications.inbox'] = ['notifications'];
  assert.throws(() => validateModules(undeclaredAppCap), /Undeclared capability dependency: admin\/notifications\.inbox/);
});

test('central scenario IDs are checked even without provider checkouts', () => {
  for (const id of ['backend', 'web', 'admin', 'ops']) {
    const config = load();
    const owner = [...config.applications, ...config.operations].find(item => item.id === id);
    owner.scenario_tests['UNKNOWN-99'] = ['case.test.ts#missing'];
    assert.throws(() => validateSpecifications(config), /Unknown implemented scenario: UNKNOWN-99/);
  }
});
