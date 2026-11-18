import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readYaml, root } from './architecture.mjs';
import path from 'node:path';

test('academic application capabilities name their providing optional module', () => {
  const { applications, modules } = readYaml(path.join(root, 'architecture/modules.yaml'));
  const consumers = {
    web: ['catalog.directory', 'catalog.read', 'catalog.enrollments', 'reviews.read', 'reviews.write', 'moderation.tasks'],
    admin: ['catalog.read', 'catalog.maintain', 'catalog.import', 'reviews.moderate', 'moderation.tasks'],
  };
  for (const [client, capabilities] of Object.entries(consumers)) {
    const app = applications.find(item => item.id === client);
    for (const name of capabilities) {
      const provider = modules.find(item => item.capabilities?.includes(name));
      assert(provider, name);
      assert(app.optional.includes(provider.id), client + '/' + provider.id);
      assert.deepEqual(app.capability_requires[name], [provider.id], client + '/' + name);
    }
  }
});
