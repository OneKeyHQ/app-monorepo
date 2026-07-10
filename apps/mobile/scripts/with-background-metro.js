#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */

const { spawn } = require('node:child_process');
const net = require('node:net');

const BACKGROUND_METRO_PORT = 8082;
const BACKGROUND_METRO_START_TIMEOUT_MS = 30_000;
const PORT_RETRY_INTERVAL_MS = 250;
const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const managedChildren = [];

let lifecycleActive = false;
let stopping = false;

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (listening) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(listening);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function stopManagedChildren(signal = 'SIGTERM') {
  for (const { child } of managedChildren) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

function stopFromChild(label, code, signal) {
  if (!lifecycleActive || stopping) return;
  stopping = true;
  stopManagedChildren();
  process.exitCode = code ?? (signal ? 1 : 0);
  console.log(`[native-dev] ${label} exited${signal ? ` with ${signal}` : ''}`);
}

function spawnYarn(args, label, { failOnCleanExit = false } = {}) {
  const child = spawn(yarnCommand, args, {
    env: {
      ...process.env,
      ENABLE_NATIVE_BACKGROUND_THREAD: 'true',
    },
    stdio: 'inherit',
  });
  const managedChild = { child, label, spawnError: undefined };
  managedChildren.push(managedChild);

  child.once('error', (error) => {
    managedChild.spawnError = error;
    console.error(`[native-dev] Failed to start ${label}:`, error);
    stopFromChild(label, 1);
  });
  child.once('exit', (code, signal) => {
    stopFromChild(label, failOnCleanExit && code === 0 ? 1 : code, signal);
  });

  return managedChild;
}

async function waitForBackgroundMetro(managedChild) {
  const deadline = Date.now() + BACKGROUND_METRO_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (managedChild.spawnError) {
      throw managedChild.spawnError;
    }
    if (
      managedChild.child.exitCode !== null ||
      managedChild.child.signalCode !== null
    ) {
      throw new Error('Background Metro exited before port 8082 was ready.');
    }
    if (await isPortListening(BACKGROUND_METRO_PORT)) return;
    await new Promise((resolve) => setTimeout(resolve, PORT_RETRY_INTERVAL_MS));
  }
  throw new Error('Timed out waiting for background Metro on port 8082.');
}

function registerSignalHandlers() {
  const handleSignal = (signal, exitCode) => {
    if (stopping) return;
    stopping = true;
    stopManagedChildren(signal);
    process.exitCode = exitCode;
  };
  process.once('SIGINT', () => handleSignal('SIGINT', 130));
  process.once('SIGTERM', () => handleSignal('SIGTERM', 143));
}

async function main() {
  const targetArgs = process.argv.slice(2);
  if (targetArgs.length === 0) {
    throw new Error('Missing the yarn command to run with background Metro.');
  }

  registerSignalHandlers();

  if (await isPortListening(BACKGROUND_METRO_PORT)) {
    console.log('[native-dev] Reusing background Metro on port 8082.');
  } else {
    console.log('[native-dev] Starting background Metro on port 8082.');
    const backgroundMetro = spawnYarn(
      ['native-bundle:bg'],
      'background Metro',
      { failOnCleanExit: true },
    );
    await waitForBackgroundMetro(backgroundMetro);
  }

  spawnYarn(targetArgs, targetArgs.join(' '));
  lifecycleActive = true;

  const exitedChild = managedChildren.find(
    ({ child }) => child.exitCode !== null || child.signalCode !== null,
  );
  if (exitedChild) {
    stopFromChild(
      exitedChild.label,
      exitedChild.child.exitCode,
      exitedChild.child.signalCode,
    );
  }
}

void main().catch((error) => {
  console.error(
    '[native-dev] Unable to start native development services:',
    error,
  );
  stopping = true;
  stopManagedChildren();
  process.exitCode = 1;
});
