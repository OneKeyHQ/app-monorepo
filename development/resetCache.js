/* eslint-disable no-unused-expressions  */
const childProcess = require('child_process');

function exec(fullCmd) {
  const [cmd, ...args] = fullCmd.split(/\s+/);
  return new Promise((resolve, _reject) => {
    const child = childProcess.spawn(cmd, args, {
      stdio: [
        process.stdin, // 0 use parents stdin for child
        process.stdout, // 1 use parent's stdout stream - IMPORTANT if we dont do this things like the spinner will break the automation.
        'pipe', // 2 fs.openSync('err.out', 'w') // direct child's stderr to a file
      ],
    });
    child.on('close', (code, signal) => {
      resolve({
        code,
        signal,
        child,
      });
    });
    return child;
  });
}

void Promise.race([
  new Promise((resolve) => setTimeout({ resolve }, 60 * 1000)),
  Promise.all([
    exec('yarn expo start --clear'),
    exec('yarn react-native start --reset-cache'),
  ]),
]);
