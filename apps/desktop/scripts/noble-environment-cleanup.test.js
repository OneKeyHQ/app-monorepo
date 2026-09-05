const { spawnSync } = require('child_process');

// Run with a rebuilt Noble binding. A Node main-process process.exit() skips
// environment cleanup, so use Electron's Node runtime with a Worker instead.
const describeMac = process.platform === 'darwin' ? describe : describe.skip;

describeMac('Noble native environment cleanup', () => {
  test.each([
    'uninitialized',
    'initialized',
    'queued-callbacks',
    'stopped',
    'restarted',
    'multiple-instances',
  ])('exits after %s without hanging or aborting', (scenario) => {
    const noblePath = require.resolve('@stoprocent/noble');
    const workerSource = `
      const { parentPort, workerData } = require('worker_threads');
      const noble = require(workerData.noblePath);
      const finish = () => {
        parentPort.postMessage('ready-to-exit');
        process.exit(0);
      };
      if (workerData.scenario === 'uninitialized') finish();
      // Force native initialization without requiring a powered-on radio.
      void noble.state;
      noble.once('scanStop', () => {
        setImmediate(() => {
          if (workerData.scenario === 'queued-callbacks') {
            for (let i = 0; i < 100; i += 1) noble._bindings.stopScanning();
          } else if (workerData.scenario === 'stopped') {
            noble.stop();
          } else if (workerData.scenario === 'restarted') {
            noble.stop();
            noble._bindings.start();
            noble.once('scanStop', () => setImmediate(finish));
            noble._bindings.stopScanning();
            return;
          } else if (workerData.scenario === 'multiple-instances') {
            const second = noble.withBindings('mac');
            void second.state;
            second._bindings.stopScanning();
          }
          finish();
        });
      });
      noble._bindings.stopScanning();
    `;
    const parentSource = `
      const { Worker } = require('worker_threads');
      const worker = new Worker(${JSON.stringify(workerSource)}, {
        eval: true,
        workerData: ${JSON.stringify({ noblePath, scenario })},
      });
      let readyToExit = false;
      worker.on('message', () => { readyToExit = true; });
      worker.on('exit', (code) => {
        if (!readyToExit || code !== 0) process.exit(1);
        console.log('native-cleanup-complete');
      });
    `;
    const result = spawnSync(require('electron'), ['-e', parentSource], {
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      timeout: 5000,
      killSignal: 'SIGKILL',
    });

    expect({
      error: result.error?.message,
      signal: result.signal,
      status: result.status,
    }).toEqual({ error: undefined, signal: null, status: 0 });
    expect(result.stdout).toContain('native-cleanup-complete');
  });
});
