'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createMessageHandler } = require('../src/message-handler');

function fixture(options = {}) {
  const events = [];
  const chat = {
    sendStateTyping: async () => events.push('typing'),
    clearState: async () => events.push('clear'),
  };
  const contact = { pushname: 'Cliente', number: '573000000001', id: { _serialized: '123@lid' } };
  const message = {
    from: '123@lid', fromMe: false, hasMedia: false, type: 'chat', body: ' Hola ', timestamp: 1,
    id: { _serialized: 'message-1' },
    getContact: async () => contact,
    getChat: async () => chat,
    reply: async (value) => events.push(`reply:${value}`),
  };
  const agentClient = options.agentClient || {
    sendMessage: async (payload) => {
      events.push(`agent:${payload.sender_name}:${payload.text}`);
      return 'Hola Cliente';
    },
  };
  const acl = options.acl || { isAllowed: () => true };
  const logger = {
    error: (event, details) => events.push(`error:${event}:${details.reason}`),
    warn: (event, details) => events.push(`warn:${event}:${details.reason}`),
  };
  const env = { TYPING_ENABLED: '1', TYPING_MIN_MS: '0', BRIDGE_ERROR_REPLY: 'Error temporal' };
  return { events, message, handler: createMessageHandler({ agentClient, acl, logger, env }) };
}

test('maps, types and replies to an allowed private message', async () => {
  const { events, message, handler } = fixture();
  assert.deepEqual(await handler(message), { status: 'replied' });
  assert.deepEqual(events, ['typing', 'agent:Cliente:Hola', 'reply:Hola Cliente', 'clear']);
});

test('does not contact the agent when ACL denies the sender', async () => {
  const { events, message, handler } = fixture({ acl: { isAllowed: () => false } });
  assert.deepEqual(await handler(message), { status: 'denied' });
  assert.deepEqual(events, []);
});

test('clears typing and sends generic reply when agent fails', async () => {
  const agentClient = { sendMessage: async () => { throw new Error('private upstream detail'); } };
  const { events, message, handler } = fixture({ agentClient });
  assert.deepEqual(await handler(message), { status: 'failed' });
  assert.deepEqual(events, [
    'typing',
    'clear',
    'error:message_processing_failed:agent_failure',
    'reply:Error temporal',
  ]);
});

test('rejects invalid typing configuration during startup', () => {
  const agentClient = { sendMessage: async () => 'Hola' };
  const acl = { isAllowed: () => true };
  assert.throws(
    () => createMessageHandler({ agentClient, acl, env: { TYPING_ENABLED: 'yes' } }),
    /typing_enabled_invalid/,
  );
  assert.throws(
    () => createMessageHandler({ agentClient, acl, env: { TYPING_MIN_MS: '-1' } }),
    /typing_min_ms_invalid/,
  );
});

test('fails closed without replying when contact lookup fails', async () => {
  const { events, message, handler } = fixture();
  message.getContact = async () => { throw new Error('private provider detail'); };

  assert.deepEqual(await handler(message), { status: 'failed' });
  assert.deepEqual(events, ['error:message_processing_failed:contact_lookup_failed']);
});

test('continues without typing when chat lookup fails after ACL approval', async () => {
  const { events, message, handler } = fixture();
  message.getChat = async () => { throw new Error('private provider detail'); };

  assert.deepEqual(await handler(message), { status: 'replied' });
  assert.deepEqual(events, [
    'warn:message_typing_unavailable:chat_lookup_failed',
    'agent:Cliente:Hola',
    'reply:Hola Cliente',
  ]);
});

test('contains a failure while sending the generic reply', async () => {
  const agentClient = { sendMessage: async () => { throw new Error('upstream failed'); } };
  const { events, message, handler } = fixture({ agentClient });
  message.reply = async () => { throw new Error('reply failed'); };

  assert.deepEqual(await handler(message), { status: 'failed' });
  assert.deepEqual(events, [
    'typing',
    'clear',
    'error:message_processing_failed:agent_failure',
    'error:message_error_reply_failed:reply_failed',
  ]);
});
