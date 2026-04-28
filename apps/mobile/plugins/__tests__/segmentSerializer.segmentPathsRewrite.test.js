// apps/mobile/plugins/__tests__/segmentSerializer.segmentPathsRewrite.test.js
//
// Regression test for the iOS 6.3.0-10069276 OTA crash: segment modules
// that contain async-require paths must have those paths rewritten to
// `seg:` keys before the segment is written to disk. Without this,
// runtime hits installProdBundleLoader's eager-fallback short-circuit
// for the unrewritten Metro URL, then crashes with
// "Requiring unknown module <id>" because the actual segment was never
// loaded.
const {
  rewriteAsyncPathsInModules,
} = require('../segmentSerializer.rewriteAsyncPaths');

describe('segment serializer — segment async-path rewrite', () => {
  it('rewrites async paths inside segment modules (regression: ios 10069276)', () => {
    const moduleToSegment = new Map([
      [777, 'seg:kit.views.Receive.pages.ReceiveToken'],
      [3904, 'seg:kit.views.Send.pages.SendConfirm.SendConfirmContainer'],
    ]);

    // Simulates a single segment's `[id, code]` array — what segmentOutputs
    // hands to bundleToString in Step 7.
    const segModules = [
      [
        2500, // SendDataInputContainer module
        `__d(fn,2500,[777,3904]);var p={"777":"/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false","3904":"/packages/kit/src/views/Send/pages/SendConfirm/SendConfirmContainer.bundle?modulesOnly=true&runModule=false"};`,
      ],
    ];

    rewriteAsyncPathsInModules(segModules, moduleToSegment);

    expect(segModules[0][1]).toContain(
      '"777":"seg:kit.views.Receive.pages.ReceiveToken"',
    );
    expect(segModules[0][1]).toContain(
      '"3904":"seg:kit.views.Send.pages.SendConfirm.SendConfirmContainer"',
    );
    // Hard guarantee: no Metro default URL leaks past rewrite
    expect(segModules[0][1]).not.toMatch(/\.bundle\?modulesOnly=true&runModule=false/);
  });
});
