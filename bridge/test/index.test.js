'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { registerClientEvents, whatsAppClientOptions } = require('../src/index');

function fixture() {
  const listeners = new Map();
  const calls = [];
  const client = {
    pupPage: { on: (event) => calls.push(`page:${event}`) },
    on(event, listener) {
      listeners.set(event, listener);
    },
  };
  const files = {
    writePairingQr: async (value) => calls.push(`write:${value}`),
    clearPairingQr: () => calls.push('clear:qr'),
    clearReady: () => calls.push('clear:ready'),
    markReady: () => calls.push('mark:ready'),
    clearRuntimeFiles: () => calls.push('clear:all'),
  };
  const logger = {
    info: (...args) => calls.push(`info:${JSON.stringify(args)}`),
    warn: (...args) => calls.push(`warn:${JSON.stringify(args)}`),
    error: (...args) => calls.push(`error:${JSON.stringify(args)}`),
  };
  registerClientEvents({ client, handler: async () => undefined, files, logger });
  return { calls, emit: (event, value) => listeners.get(event)(value) };
}

test('stores a pairing QR without including it in logs', async () => {
  const { calls, emit } = fixture();

  await emit('qr', 'private-qr-value');

  assert.deepEqual(calls, [
    'info:["whatsapp_qr_received"]',
    'clear:ready',
    'write:private-qr-value',
  ]);
  assert.equal(calls[0].includes('private-qr-value'), false);
});

test('updates runtime files for ready, authentication failure and disconnection', () => {
  const { calls, emit } = fixture();

  emit('authenticated');
  emit('ready');
  emit('auth_failure');
  emit('disconnected', 'LOGOUT');

  assert.deepEqual(calls, [
    'clear:qr',
    'info:["whatsapp_authenticated"]',
    'page:pageerror',
    'mark:ready',
    'info:["whatsapp_ready"]',
    'clear:all',
    'error:["whatsapp_auth_failure"]',
    'clear:all',
    'warn:["whatsapp_disconnected",{"reason":"LOGOUT"}]',
  ]);
});

test('uses writable ephemeral storage for the WhatsApp Web cache', () => {
  class FakeLocalAuth {
    constructor(options) {
      this.options = options;
    }
  }

  const options = whatsAppClientOptions({}, FakeLocalAuth);

  assert.deepEqual(options.authStrategy.options, { dataPath: '/app/session' });
  assert.deepEqual(options.webVersionCache, {
    type: 'local',
    path: '/tmp/wa-bridge-web-cache',
  });
});
