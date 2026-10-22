const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const javaRoot = path.join(
  __dirname,
  '../android/app/src/main/java/so/onekey/app/wallet',
);
const application = fs.readFileSync(
  path.join(javaRoot, 'BaseMainApplication.java'),
  'utf8',
);
const activity = fs.readFileSync(
  path.join(javaRoot, 'MainActivity.java'),
  'utf8',
);

test('the background authorization bridge includes CloudFs before bootstrapping bg', () => {
  const prefixes = [
    ...application.matchAll(
      /addBgActivityBridgeListenerClassPrefix\("([^"]+)"\)/gu,
    ),
  ].map((match) => match[1]);
  assert.ok(
    prefixes.some((prefix) =>
      'com.rncloudfs.RNCloudFsModule'.startsWith(prefix),
    ),
  );
  assert.ok(
    prefixes.some((prefix) =>
      'com.reactnativegooglesignin.RNGoogleSigninModule$RNActivityEventListener'.startsWith(
        prefix,
      ),
    ),
  );
  assert.ok(
    !prefixes.some((prefix) => 'com.unrelated.NativeModule'.startsWith(prefix)),
  );
  // Bootstrap is deferred until Activity startup after the OTA rollback check.
  // Register the bridge during Application startup, before lifecycle dispatch.
  const applicationStartup = application.slice(
    application.indexOf('public void onCreate()'),
    application.indexOf(
      'ApplicationLifecycleDispatcher.onApplicationCreate(this);',
    ),
  );
  assert.match(
    applicationStartup,
    /registerBackgroundThreadActivityBridge\(\);/u,
  );
  const deferredStartup = application.slice(
    application.indexOf('public void startBackgroundThreadIfNeeded('),
    application.indexOf('boolean startScheduled ='),
  );
  assert.match(deferredStartup, /setupBackgroundThreadBootstrap\(\);/u);
  assert.match(
    activity,
    /\.startBackgroundThreadIfNeeded\("main_activity_pre_super"\);/u,
  );
});

test('success, cancellation, and nullable authorization results reach the background bridge unchanged', () => {
  assert.match(
    activity,
    /super\.onActivityResult\(requestCode, resultCode, data\);/u,
  );
  assert.match(
    activity,
    /dispatchActivityResult\(this, requestCode, resultCode, data\);/u,
  );
  const handler = activity.slice(
    activity.lastIndexOf('public void onActivityResult('),
    activity.indexOf('public void onNewIntent('),
  );
  assert.doesNotMatch(handler, /RESULT_OK|RESULT_CANCELED|data\s*!=\s*null/u);
});

test('the same background bridge receives host lifecycle transitions', () => {
  for (const event of ['Resumed', 'Paused', 'Destroyed']) {
    assert.ok(application.includes(`dispatchActivity${event}(activity)`));
  }
});
