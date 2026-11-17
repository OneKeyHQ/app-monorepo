/** @jest-environment jsdom */
import { useReviewControl } from '.';

import { renderHook } from '@testing-library/react';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isAppleStoreEnv: false,
    isMas: false,
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const state: { reviewControl?: boolean } = {};
  return {
    __mockSettingsState: state,
    useSettingsPersistAtom: () => [state, jest.fn()],
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings');
  const state: {
    enabled: boolean;
    settings: { ignoreReviewControl?: boolean };
  } = { enabled: false, settings: {} };
  return {
    ...actual,
    __mockDevSettingsState: state,
    useDevSettingsPersistAtom: () => [state, jest.fn()],
  };
});

const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as { isAppleStoreEnv: boolean; isMas: boolean };
const settingsState = jest.requireMock(
  '@onekeyhq/kit-bg/src/states/jotai/atoms',
).__mockSettingsState as { reviewControl?: boolean };
const devSettingsState = jest.requireMock(
  '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings',
).__mockDevSettingsState as {
  enabled: boolean;
  settings: { ignoreReviewControl?: boolean };
};

function readReviewControl() {
  return renderHook(() => useReviewControl()).result.current;
}

describe('useReviewControl', () => {
  beforeEach(() => {
    mockPlatformEnv.isAppleStoreEnv = false;
    mockPlatformEnv.isMas = false;
    settingsState.reviewControl = undefined;
    devSettingsState.enabled = false;
    devSettingsState.settings = {};
  });

  it('follows the remote flag on gated platforms', () => {
    mockPlatformEnv.isAppleStoreEnv = true;

    settingsState.reviewControl = false;
    expect(readReviewControl()).toBe(false);

    settingsState.reviewControl = true;
    expect(readReviewControl()).toBe(true);
  });

  it('always shows on ungated platforms', () => {
    settingsState.reviewControl = false;
    expect(readReviewControl()).toBe(true);
  });

  it('keeps the gate when the dev override is left at its default', () => {
    mockPlatformEnv.isAppleStoreEnv = true;
    settingsState.reviewControl = false;
    devSettingsState.enabled = true;

    expect(readReviewControl()).toBe(false);
  });

  it('forces visibility on gated platforms when the dev override is on', () => {
    mockPlatformEnv.isMas = true;
    settingsState.reviewControl = false;
    devSettingsState.enabled = true;
    devSettingsState.settings = { ignoreReviewControl: true };

    expect(readReviewControl()).toBe(true);
  });

  it('ignores the dev override while dev mode is disabled', () => {
    mockPlatformEnv.isAppleStoreEnv = true;
    settingsState.reviewControl = false;
    devSettingsState.enabled = false;
    devSettingsState.settings = { ignoreReviewControl: true };

    expect(readReviewControl()).toBe(false);
  });
});
