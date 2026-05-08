// apps/mobile/plugins/__tests__/segmentSerializer.segmentPathsRewrite.test.js
//
// Contract test: any caller of rewriteAsyncPathsInModules must rewrite
// every async-require URL in a synthetic segment-shape input. Note this
// does NOT catch a wiring regression in segmentSerializer.js (where the
// real bug lived) — that regression class is closed by Task C's
// build-time integrity scanner running across emitted .seg.js files.
// This file's job is to make sure the helper API stays correct as new
// callers are added.
const {
  rewriteAsyncPathsInModules,
} = require('../segmentSerializer.rewriteAsyncPaths');

describe('rewriteAsyncPathsInModules — segment-shape contract', () => {
  it('rewrites every Metro async URL inside a synthetic segment module', () => {
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
    expect(segModules[0][1]).not.toMatch(
      /\.bundle\?modulesOnly=true&runModule=false/,
    );
  });
});
