'use strict';

const { createSecretsManagerClient } = require('./secrets-manager-client');

function internalTokenSecretName(env = process.env) {
  const configured = String(env.SECRET_INTERNAL_API_TOKEN_NAME || '').trim();
  if (configured) return configured;
  const instanceId = String(env.INSTANCE_ID || 'local').trim() || 'local';
  return `wa-agent-core/${instanceId}/internal-api-token`;
}

async function loadRuntimeSecrets(options = {}) {
  const env = options.env || process.env;
  const client = options.client || createSecretsManagerClient({ env });
  const value = await client.getSecretString(internalTokenSecretName(env));
  if (!value) throw new Error('secret_empty:INTERNAL_API_TOKEN');
  env.INTERNAL_API_TOKEN = value;
  return ['INTERNAL_API_TOKEN'];
}

module.exports = { internalTokenSecretName, loadRuntimeSecrets };
