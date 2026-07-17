'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LOCK_FILES = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie']);

function clearStaleChromiumLocks(rootPath) {
  if (!fs.existsSync(rootPath)) return 0;
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'EACCES' || error?.code === 'EPERM') return 0;
    throw error;
  }
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      removed += clearStaleChromiumLocks(entryPath);
    } else if (LOCK_FILES.has(entry.name)) {
      try {
        fs.rmSync(entryPath, { force: true });
        removed += 1;
      } catch (error) {
        if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error;
      }
    }
  }
  return removed;
}

module.exports = { clearStaleChromiumLocks };
