'use strict';

const { loadRuntimeSecrets } = require('./runtime-secrets');

async function bootstrap() {
  await loadRuntimeSecrets();
  const { start } = require('./index');
  await start();
}

bootstrap().catch((error) => {
  console.error('bridge_startup_failed', { reason: String(error?.name || 'startup_error') });
  process.exitCode = 1;
});
