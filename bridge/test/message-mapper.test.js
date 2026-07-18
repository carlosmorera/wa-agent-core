'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { mapMessage } = require('../src/message-mapper');

test('maps a WhatsApp message to the v1 agent request contract', () => {
  const message = {
    id: { _serialized: 'message-1' },
    from: '573000000001@c.us',
    body: ' Hola ',
    timestamp: 1750000000,
  };
  const contact = {
    id: { _serialized: '573000000001@c.us' },
    pushname: 'Cliente',
  };

  assert.deepEqual(mapMessage(message, contact), {
    message_id: 'message-1',
    chat_id: '573000000001@c.us',
    sender_id: '573000000001@c.us',
    sender_name: 'Cliente',
    text: 'Hola',
    timestamp: 1750000000,
  });
});
