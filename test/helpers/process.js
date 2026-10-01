'use strict';

const { spawnSync } = require('node:child_process');

// A nonzero exit can be a fixture's expected rejection. Startup errors,
// signals and exceeded resource limits never count as that rejection.
function runSync(operation, command, args, { cwd, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd, timeout, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    killSignal: 'SIGKILL'
  });
  if (result.error || result.signal) {
    throw new Error(`${operation} (${cwd}): ${result.error?.code || result.signal}; ` +
      `timeout=${timeout}ms\n${result.stdout || ''}\n${result.stderr || ''}`, { cause: result.error });
  }
  return result;
}

module.exports = { runSync };
