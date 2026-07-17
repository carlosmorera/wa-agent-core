'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { shouldProcessMessage } = require('../src/message-filter');

const message = { from: '573000000001@c.us', fromMe: false, hasMedia: false, type: 'chat', body: 'Hola' };

test('accepts a private text message', () => assert.equal(shouldProcessMessage(message), true));

for (const [name, override] of [
  ['own message', { fromMe: true }],
  ['media', { hasMedia: true }],
  ['group', { from: '123@g.us' }],
  ['status', { from: 'status@broadcast' }],
  ['empty text', { body: '   ' }],
  ['unsupported type', { type: 'audio' }],
]) {
  test(`ignores ${name}`, () => assert.equal(shouldProcessMessage({ ...message, ...override }), false));
}

test('accepts a private LID chat', () => {
  assert.equal(shouldProcessMessage({ ...message, from: '123@lid' }), true);
});
