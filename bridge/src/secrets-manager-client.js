'use strict';

const crypto = require('node:crypto');

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signingKey(secretKey, dateStamp, region, service) {
  const date = hmac(`AWS4${secretKey}`, dateStamp);
  const regional = hmac(date, region);
  const scoped = hmac(regional, service);
  return hmac(scoped, 'aws4_request');
}

function signHeaders({ url, body, target, region, accessKeyId, secretAccessKey, now }) {
  const parsed = new URL(url);
  const timestamp = amzDate(now);
  const dateStamp = timestamp.slice(0, 8);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${parsed.host}\nx-amz-date:${timestamp}\nx-amz-target:${target}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST', parsed.pathname || '/', parsed.search.slice(1), canonicalHeaders,
    signedHeaders, sha256(body),
  ].join('\n');
  const scope = `${dateStamp}/${region}/secretsmanager/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(secretAccessKey, dateStamp, region, 'secretsmanager'), stringToSign, 'hex');
  return {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Date': timestamp,
    'X-Amz-Target': target,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function createSecretsManagerClient(options = {}) {
  const env = options.env || process.env;
  const endpoint = String(options.endpoint || env.FLOCI_AWS_ENDPOINT_URL || 'http://floci:4566').replace(/\/+$/, '');
  const region = options.region || env.AWS_DEFAULT_REGION || 'us-east-1';
  const accessKeyId = options.accessKeyId || env.AWS_ACCESS_KEY_ID || 'test';
  const secretAccessKey = options.secretAccessKey || env.AWS_SECRET_ACCESS_KEY || 'test';
  const fetchImpl = options.fetchImpl || global.fetch;

  return {
    async getSecretString(secretId) {
      const name = String(secretId || '').trim();
      if (!name) throw new Error('secret_id_required');
      const body = JSON.stringify({ SecretId: name });
      const headers = signHeaders({
        url: endpoint, body, target: 'secretsmanager.GetSecretValue',
        region, accessKeyId, secretAccessKey,
      });
      const response = await fetchImpl(endpoint, {
        method: 'POST', headers, body, signal: AbortSignal.timeout(options.timeoutMs || 8000),
      });
      if (!response.ok) throw new Error(`secret_read_failed:${name}:${response.status}`);
      const payload = await response.json();
      if (payload.SecretString === undefined || payload.SecretString === null) {
        throw new Error(`secret_not_found:${name}`);
      }
      return String(payload.SecretString);
    },
  };
}

module.exports = { createSecretsManagerClient, signHeaders };
