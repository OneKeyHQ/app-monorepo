/* eslint-disable no-unused-expressions  */
const childProcess = require('child_process');

function exec(fullCmd) {
  const [cmd, ...args] = fullCmd.split(/\s+/);
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(cmd, args, {
      stdio: [
        process.stdin, // 0 use parents stdin for child
        process.stdout, // 1 use parent's stdout stream - IMPORTANT if we dont do this things like the spinner will break the automation.
        'pipe', // 2 fs.openSync('err.out', 'w') // direct child's stderr to a file
      ],
    });
    child.on('close', (code, signal, p1, p2, p3) => {
      resolve({
        code,
        signal,
        child,
      });
    });
    return child;
  });
}

// **** clean ReactNative and Expo Metro bundler cache
exec('yarn expo start --clear');
exec('yarn react-native start --reset-cache');
// exec('yarn expo build:ios --clear-provisioning-profile');

setTimeout(() => {
  process.exit(0);
}, 20 * 1000);
