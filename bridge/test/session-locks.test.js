'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { clearStaleChromiumLocks } = require('../src/session-locks');

test('removes only stale Chromium singleton locks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-session-'));
  const profile = path.join(root, 'session', 'Default');
  fs.mkdirSync(profile, { recursive: true });
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'Cookies']) {
    fs.writeFileSync(path.join(profile, name), name);
  }
  assert.equal(clearStaleChromiumLocks(root), 3);
  assert.equal(fs.existsSync(path.join(profile, 'Cookies')), true);
  assert.equal(fs.existsSync(path.join(profile, 'SingletonLock')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips profile directories that belong to another runtime user', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-session-denied-'));
  const inaccessible = path.join(root, 'Profile');
  fs.mkdirSync(inaccessible);
  fs.chmodSync(inaccessible, 0o000);
  assert.equal(clearStaleChromiumLocks(root), 0);
  fs.chmodSync(inaccessible, 0o700);
  fs.rmSync(root, { recursive: true, force: true });
});
