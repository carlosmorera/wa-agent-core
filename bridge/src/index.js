'use strict';

const { createAcl } = require('./acl');
const { createAgentClient } = require('./agent-client');
const { createMessageHandler } = require('./message-handler');
const runtimeFiles = require('./runtime-files');
const { clearStaleChromiumLocks } = require('./session-locks');

function whatsAppClientOptions(env, LocalAuth) {
  return {
    authStrategy: new LocalAuth({ dataPath: '/app/session' }),
    webVersionCache: { type: 'local', path: '/tmp/wa-bridge-web-cache' },
    puppeteer: {
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  };
}

function createWhatsAppClient(env = process.env) {
  const { Client, LocalAuth } = require('whatsapp-web.js');
  return new Client(whatsAppClientOptions(env, LocalAuth));
}

function registerClientEvents({ client, handler, files = runtimeFiles, logger = console }) {
  let pageDiagnosticsAttached = false;
  client.on('qr', async (qr) => {
    logger.info('whatsapp_qr_received');
    try {
      files.clearReady();
      await files.writePairingQr(qr);
    } catch {
      files.clearPairingQr();
      logger.error('whatsapp_qr_write_failed', { reason: 'file_write_failed' });
    }
  });
  client.on('ready', () => {
    files.markReady();
    logger.info('whatsapp_ready');
  });
  client.on('authenticated', () => {
    files.clearPairingQr();
    logger.info('whatsapp_authenticated');
    if (!pageDiagnosticsAttached && client.pupPage) {
      client.pupPage.on('pageerror', (error) => {
        logger.error('whatsapp_page_error', { reason: String(error?.name || 'page_error') });
      });
      pageDiagnosticsAttached = true;
    }
  });
  client.on('loading_screen', (percent) => {
    logger.info('whatsapp_loading', { percent: Number(percent) || 0 });
  });
  client.on('change_state', (state) => {
    logger.info('whatsapp_state_changed', { state: String(state || 'unknown') });
  });
  client.on('message', (message) => {
    handler(message).catch(() => logger.error('message_handler_unexpected_failure'));
  });
  client.on('auth_failure', () => {
    files.clearRuntimeFiles();
    logger.error('whatsapp_auth_failure');
  });
  client.on('disconnected', (reason) => {
    files.clearRuntimeFiles();
    logger.warn('whatsapp_disconnected', { reason: String(reason || 'unknown') });
  });
}

async function start(env = process.env) {
  runtimeFiles.clearRuntimeFiles();
  const removedLocks = clearStaleChromiumLocks('/app/session');
  if (removedLocks) console.info('chromium_stale_locks_removed', { count: removedLocks });
  const handler = createMessageHandler({ agentClient: createAgentClient({ env }), acl: createAcl(env), env });
  const client = createWhatsAppClient(env);
  registerClientEvents({ client, handler });
  await client.initialize();
}

module.exports = { createWhatsAppClient, registerClientEvents, start, whatsAppClientOptions };
