const assert = require('node:assert/strict');
const path = require('node:path');

const { app } = require('electron');

const nativeDirectory = path.resolve(
  process.env.ONEKEY_REVENUECAT_NATIVE_DIRECTORY ||
    path.join(__dirname, '../native-modules/revenuecat-macos/build/universal'),
);

const timeout = setTimeout(() => {
  console.error('RevenueCat native callback did not settle');
  app.exit(1);
}, 15_000);

app.whenReady().then(async () => {
  try {
    const bridge = require(nativeDirectory);
    await assert.rejects(bridge.invoke('getAppUserId'), (error) => {
      assert.equal(error.code, 'BRIDGE_ERROR');
      assert.equal(error.userCancelled, false);
      assert.match(error.message, /must be configured/);
      return true;
    });
    await assert.rejects(bridge.invoke('configure', { apiKey: '' }), {
      code: 'BRIDGE_ERROR',
      message: 'Missing or invalid apiKey',
    });
    console.log(
      `RevenueCat ${process.arch} native load and asynchronous error round trip passed`,
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  } finally {
    clearTimeout(timeout);
  }
});
