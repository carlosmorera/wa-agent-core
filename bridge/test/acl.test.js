'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAcl } = require('../src/acl');

test('open ACL accepts any contact', () => {
  assert.equal(createAcl({ BRIDGE_ACL_MODE: 'open' }).isAllowed({}), true);
});

test('allowlist normalizes configured numbers and LID contacts', () => {
  const acl = createAcl({ BRIDGE_ACL_MODE: 'allowlist', BRIDGE_ALLOWED_NUMBERS: '+57 300 000 0001' });
  assert.equal(acl.isAllowed({ number: '573000000001', id: { _serialized: '123@lid' } }), true);
  assert.equal(acl.isAllowed({ number: '573000000002' }), false);
});

test('empty allowlist fails closed', () => {
  assert.throws(() => createAcl({ BRIDGE_ACL_MODE: 'allowlist' }), /acl_allowlist_required/);
});
