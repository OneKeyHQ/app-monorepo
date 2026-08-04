import {
  activateNativeMarketTradingViewSession,
  createNativeMarketTradingViewSessionId,
  deactivateNativeMarketTradingViewSession,
  getNativeMarketTradingViewHostSnapshot,
  releaseNativeMarketTradingViewHostIfInactive,
  requestNativeMarketTradingViewWarmup,
  resetNativeMarketTradingViewHostForTest,
  updateNativeMarketTradingViewSessionFrame,
  updateNativeMarketTradingViewSessionProps,
} from './nativeMarketTradingViewHostStore';

import type { INativeMarketTradingViewSession } from './nativeMarketTradingViewHostStore';

const scrollY = { value: 0 } as INativeMarketTradingViewSession['scrollY'];

describe('nativeMarketTradingViewHostStore', () => {
  beforeEach(() => {
    resetNativeMarketTradingViewHostForTest();
  });

  it('keeps the last chart props after a detail session deactivates', () => {
    const id = createNativeMarketTradingViewSessionId();
    activateNativeMarketTradingViewSession({
      id,
      scrollY,
      props: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
      },
    });

    deactivateNativeMarketTradingViewSession(id);

    expect(getNativeMarketTradingViewHostSnapshot()).toMatchObject({
      activeSession: undefined,
      lastProps: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
      },
      mountRequested: true,
    });
  });

  it('updates only the active session frame', () => {
    const id = createNativeMarketTradingViewSessionId();
    activateNativeMarketTradingViewSession({
      id,
      scrollY,
      props: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
      },
    });

    updateNativeMarketTradingViewSessionFrame({
      id: id + 1,
      frame: {
        anchorX: 0,
        anchorY: 100,
        width: 390,
        height: 400,
        clipTop: 80,
      },
    });
    expect(getNativeMarketTradingViewHostSnapshot().activeSession?.frame).toBe(
      undefined,
    );

    updateNativeMarketTradingViewSessionFrame({
      id,
      frame: {
        anchorX: 0,
        anchorY: 100,
        width: 390,
        height: 400,
        clipTop: 80,
      },
    });
    expect(
      getNativeMarketTradingViewHostSnapshot().activeSession?.frame,
    ).toMatchObject({ height: 400, width: 390 });
  });

  it('updates active chart props without losing the measured frame', () => {
    const id = createNativeMarketTradingViewSessionId();
    const frame = {
      anchorX: 0,
      anchorY: 100,
      width: 390,
      height: 400,
      clipTop: 80,
    };
    activateNativeMarketTradingViewSession({
      id,
      frame,
      scrollY,
      props: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
      },
    });

    updateNativeMarketTradingViewSessionProps({
      id,
      props: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
        marketPrice: '1.01',
      },
    });

    expect(
      getNativeMarketTradingViewHostSnapshot().activeSession,
    ).toMatchObject({
      frame,
      props: {
        marketPrice: '1.01',
        tokenSymbol: 'ONE',
      },
    });
  });

  it('releases an inactive host but preserves an active chart', () => {
    requestNativeMarketTradingViewWarmup();
    releaseNativeMarketTradingViewHostIfInactive();
    expect(getNativeMarketTradingViewHostSnapshot().mountRequested).toBe(false);

    const id = createNativeMarketTradingViewSessionId();
    activateNativeMarketTradingViewSession({
      id,
      scrollY,
      props: {
        tokenAddress: '0x1',
        networkId: 'evm--1',
        tokenSymbol: 'ONE',
      },
    });
    releaseNativeMarketTradingViewHostIfInactive();

    expect(getNativeMarketTradingViewHostSnapshot().activeSession?.id).toBe(id);

    deactivateNativeMarketTradingViewSession(id);

    expect(getNativeMarketTradingViewHostSnapshot()).toEqual({
      activeSession: undefined,
      lastProps: undefined,
      mountRequested: false,
    });
  });
});
