import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';

import {
  clearHideTabBarRequests,
  createHideTabBarOwnerId,
  isTabBarHiddenByRequest,
  releaseHideTabBar,
  requestHideTabBar,
  setHideTabBarRequest,
} from './hideTabBarRequests';

describe('hideTabBarRequests', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    clearHideTabBarRequests();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
    clearHideTabBarRequests();
  });

  const emittedHiddenStates = (): boolean[] =>
    (emitSpy.mock.calls as [string, boolean][])
      .filter(([name]) => name === EAppEventBusNames.HideTabBar)
      .map(([, hidden]) => hidden);

  it('hides the tab bar while a single owner requests it', () => {
    requestHideTabBar('market-detail#1');
    expect(isTabBarHiddenByRequest()).toBe(true);

    releaseHideTabBar('market-detail#1');
    expect(isTabBarHiddenByRequest()).toBe(false);
    expect(emittedHiddenStates()).toEqual([true, false]);
  });

  it('keeps the tab bar hidden when a leaving instance releases its own request', () => {
    const leaving = createHideTabBarOwnerId('market-detail');
    const surviving = createHideTabBarOwnerId('market-detail');
    expect(leaving).not.toBe(surviving);

    requestHideTabBar(leaving);
    requestHideTabBar(surviving);
    // A stack collapse runs the leaving instance's focus cleanup last.
    releaseHideTabBar(leaving);

    expect(isTabBarHiddenByRequest()).toBe(true);
    expect(emittedHiddenStates()).toEqual([true, true, true]);
  });

  it('keeps the tab bar hidden when another screen still owns a request', () => {
    requestHideTabBar('perp-market');
    requestHideTabBar('discovery-browser');
    releaseHideTabBar('discovery-browser');

    expect(isTabBarHiddenByRequest()).toBe(true);
  });

  it('is idempotent for repeated requests and releases of one owner', () => {
    requestHideTabBar('market-detail#1');
    requestHideTabBar('market-detail#1');
    releaseHideTabBar('market-detail#1');

    expect(isTabBarHiddenByRequest()).toBe(false);
  });

  it('ignores a release from an owner that never requested', () => {
    requestHideTabBar('market-detail#1');
    releaseHideTabBar('never-registered');

    expect(isTabBarHiddenByRequest()).toBe(true);
  });

  it('toggles a single owner through setHideTabBarRequest', () => {
    setHideTabBarRequest('discovery-browser', true);
    expect(isTabBarHiddenByRequest()).toBe(true);

    setHideTabBarRequest('discovery-browser', false);
    expect(isTabBarHiddenByRequest()).toBe(false);
  });

  it('shows the tab bar again once every owner is released', () => {
    const first = createHideTabBarOwnerId('market-detail');
    const second = createHideTabBarOwnerId('market-detail');
    requestHideTabBar(first);
    requestHideTabBar(second);
    releaseHideTabBar(first);
    releaseHideTabBar(second);

    expect(isTabBarHiddenByRequest()).toBe(false);
    expect(emittedHiddenStates().at(-1)).toBe(false);
  });
});
