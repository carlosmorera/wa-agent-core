'use strict';

const fs = require('node:fs');

const QR_FILE = '/tmp/wa-bridge.qr.png';
const READY_FILE = '/tmp/wa-bridge.ready';

function removeFile(filePath) {
  fs.rmSync(filePath, { force: true });
}

function clearRuntimeFiles(options = {}) {
  removeFile(options.qrFile || QR_FILE);
  removeFile(options.readyFile || READY_FILE);
}

async function writePairingQr(qr, options = {}) {
  const filePath = options.filePath || QR_FILE;
  const renderer = options.renderer || require('qrcode');
  const temporaryPath = `${filePath}.tmp`;
  try {
    await renderer.toFile(temporaryPath, qr, {
      errorCorrectionLevel: 'M',
      margin: 4,
      type: 'png',
      width: 512,
    });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    removeFile(temporaryPath);
    throw error;
  }
}

function markReady(options = {}) {
  const qrFile = options.qrFile || QR_FILE;
  const readyFile = options.readyFile || READY_FILE;
  fs.writeFileSync(readyFile, 'ready\n', { mode: 0o600 });
  removeFile(qrFile);
}

function clearReady(filePath = READY_FILE) {
  removeFile(filePath);
}

function clearPairingQr(filePath = QR_FILE) {
  removeFile(filePath);
}

module.exports = {
  QR_FILE,
  READY_FILE,
  clearPairingQr,
  clearReady,
  clearRuntimeFiles,
  markReady,
  writePairingQr,
};
