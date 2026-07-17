'use strict';

const fs = require('node:fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createAcl } = require('./acl');
const { createAgentClient } = require('./agent-client');
const { createMessageHandler } = require('./message-handler');

function createWhatsAppClient(env = process.env) {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/session' }),
    puppeteer: {
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  });
}

async function start(env = process.env) {
  fs.rmSync('/tmp/wa-bridge.ready', { force: true });
  const client = createWhatsAppClient(env);
  const handler = createMessageHandler({ agentClient: createAgentClient({ env }), acl: createAcl(env), env });
  client.on('qr', (qr) => {
    console.info('whatsapp_qr_received');
    qrcode.generate(qr, { small: true });
  });
  client.on('ready', () => {
    fs.writeFileSync('/tmp/wa-bridge.ready', 'ready\n', { mode: 0o600 });
    console.info('whatsapp_ready');
  });
  client.on('message', (message) => {
    handler(message).catch(() => console.error('message_handler_unexpected_failure'));
  });
  client.on('auth_failure', () => console.error('whatsapp_auth_failure'));
  client.on('disconnected', (reason) => {
    fs.rmSync('/tmp/wa-bridge.ready', { force: true });
    console.warn('whatsapp_disconnected', { reason: String(reason || 'unknown') });
  });
  await client.initialize();
}

module.exports = { createWhatsAppClient, start };
