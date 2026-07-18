'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { clearRuntimeFiles, markReady, writePairingQr } = require('../src/runtime-files');

test('writes a pairing QR PNG to a private file without console output', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-bridge-qr-'));
  const filePath = path.join(directory, 'pairing.qr');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let generateOptions;
  const renderer = {
    async toFile(target, value, options) {
      assert.equal(value, 'private-qr-value');
      generateOptions = options;
      fs.writeFileSync(target, 'png bytes');
    },
  };

  await writePairingQr('private-qr-value', { filePath, renderer });

  assert.deepEqual(generateOptions, {
    errorCorrectionLevel: 'M', margin: 4, type: 'png', width: 512,
  });
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'png bytes');
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
});

test('replaces an existing pairing QR', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-bridge-qr-'));
  const filePath = path.join(directory, 'pairing.qr');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(filePath, 'old qr\n', { mode: 0o600 });
  const renderer = { toFile: async (target) => fs.writeFileSync(target, 'new qr') };

  await writePairingQr('new-value', { filePath, renderer });

  assert.equal(fs.readFileSync(filePath, 'utf8'), 'new qr');
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
});

test('marks ready and removes the pairing QR', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-bridge-state-'));
  const qrFile = path.join(directory, 'pairing.qr');
  const readyFile = path.join(directory, 'ready');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(qrFile, 'private qr');

  markReady({ qrFile, readyFile });

  assert.equal(fs.existsSync(qrFile), false);
  assert.equal(fs.readFileSync(readyFile, 'utf8'), 'ready\n');
  assert.equal(fs.statSync(readyFile).mode & 0o777, 0o600);
});

test('clears both runtime files', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-bridge-state-'));
  const qrFile = path.join(directory, 'pairing.qr');
  const readyFile = path.join(directory, 'ready');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(qrFile, 'private qr');
  fs.writeFileSync(readyFile, 'ready');

  clearRuntimeFiles({ qrFile, readyFile });

  assert.equal(fs.existsSync(qrFile), false);
  assert.equal(fs.existsSync(readyFile), false);
});
