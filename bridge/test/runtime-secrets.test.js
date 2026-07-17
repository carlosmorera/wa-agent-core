'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { internalTokenSecretName, loadRuntimeSecrets } = require('../src/runtime-secrets');

test('derives the secret name from the instance id', () => {
  assert.equal(
    internalTokenSecretName({ INSTANCE_ID: 'negocio-1' }),
    'wa-agent-core/negocio-1/internal-api-token',
  );
});

test('loads the token into runtime environment', async () => {
  const env = { INSTANCE_ID: 'local' };
  const client = { getSecretString: async () => 'private' };
  assert.deepEqual(await loadRuntimeSecrets({ env, client }), ['INTERNAL_API_TOKEN']);
  assert.equal(env.INTERNAL_API_TOKEN, 'private');
});

test('fails closed for an empty secret', async () => {
  const client = { getSecretString: async () => '' };
  await assert.rejects(loadRuntimeSecrets({ env: {}, client }), /secret_empty/);
});
