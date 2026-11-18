import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readYaml, root, validateModules, validateSpecifications } from './architecture.mjs';

const load = () => readYaml(path.join(root, 'architecture/modules.yaml'));
test('declared architecture and all specification owners are valid', () => {
  validateModules(load());
  validateSpecifications(load());
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
