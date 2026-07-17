'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAgentClient } = require('../src/agent-client');

test('sends the internal token and returns reply', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ reply: 'Hola' }) };
  };
  const client = createAgentClient({
    env: { AGENT_URL: 'http://agent:8000', INTERNAL_API_TOKEN: 'private' }, fetchImpl,
  });
  assert.equal(await client.sendMessage({ text: 'Hola' }), 'Hola');
  assert.equal(captured.options.headers['X-Internal-Token'], 'private');
  assert.equal(captured.url, 'http://agent:8000/v1/messages');
});

test('rejects an empty agent reply', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ reply: '' }) });
  const client = createAgentClient({ env: { INTERNAL_API_TOKEN: 'private' }, fetchImpl });
  await assert.rejects(client.sendMessage({}), /agent_reply_empty/);
});

test('requires a runtime token', () => {
  assert.throws(() => createAgentClient({ env: {} }), /internal_api_token_required/);
});
