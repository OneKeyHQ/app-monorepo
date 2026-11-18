/** @jest-environment jsdom */

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
  EXT_ONEKEY_ID_AUTH_FLOW_PARAM,
  EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM,
  EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM,
} from '@onekeyhq/shared/src/consts/authConsts';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import {
  consumeExtOneKeyIdAuthFlowFromUrl,
  redirectKeylessOneKeyIdAuthToExtExpandTab,
  redirectOneKeyIdAuthToExtExpandTab,
} from './extOneKeyIdAuthExpandTab';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiPopup: true,
    isExtensionUiExpandTab: true,
  },
}));

const mockOpenExtensionExpandTab = jest.spyOn(
  backgroundApiProxy.serviceApp,
  'openExtensionExpandTab',
);

describe('extension OneKey ID auth expand-tab handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.history.replaceState(null, '', '#/');
  });

  test('preserves the selected provider for an optional OAuth bind', async () => {
    await redirectOneKeyIdAuthToExtExpandTab({
      flow: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
      provider: EOAuthSocialLoginProvider.Apple,
    });

    expect(mockOpenExtensionExpandTab).toHaveBeenCalledWith({
      path: '/',
      params: {
        [EXT_ONEKEY_ID_AUTH_FLOW_PARAM]: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
        [EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM]: EOAuthSocialLoginProvider.Apple,
      },
    });
  });

  test('routes a required Keyless bind back through onboarding', async () => {
    await redirectKeylessOneKeyIdAuthToExtExpandTab({
      mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      provider: EOAuthSocialLoginProvider.Google,
    });

    expect(mockOpenExtensionExpandTab).toHaveBeenCalledWith({
      path: '/onboarding/OneKeyIDLogin',
      params: {
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        provider: EOAuthSocialLoginProvider.Google,
      },
    });
  });

  test('consumes and removes the selected provider with the flow params', () => {
    globalThis.history.replaceState(
      null,
      '',
      `#/?${EXT_ONEKEY_ID_AUTH_FLOW_PARAM}=${EExtOneKeyIdAuthFlow.LegacyOAuthBind}&${EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM}=${EOAuthSocialLoginProvider.Apple}&keep=true`,
    );

    expect(consumeExtOneKeyIdAuthFlowFromUrl()).toEqual({
      flow: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
      provider: EOAuthSocialLoginProvider.Apple,
      toOneKeyIdPageOnLoginSuccess: false,
    });
    expect(globalThis.location.hash).toBe('#/?keep=true');
  });

  test('carries the free-trial feature of a login to the expand tab', async () => {
    await redirectOneKeyIdAuthToExtExpandTab({
      flow: EExtOneKeyIdAuthFlow.Login,
      freeTrialFeatureId: EPrimeFeatures.BulkSend,
    });
    expect(mockOpenExtensionExpandTab).toHaveBeenCalledWith({
      path: '/',
      params: {
        [EXT_ONEKEY_ID_AUTH_FLOW_PARAM]: EExtOneKeyIdAuthFlow.Login,
        [EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM]: EPrimeFeatures.BulkSend,
      },
    });

    globalThis.history.replaceState(
      null,
      '',
      `#/?${EXT_ONEKEY_ID_AUTH_FLOW_PARAM}=${EExtOneKeyIdAuthFlow.Login}&${EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM}=${EPrimeFeatures.BulkSend}`,
    );
    expect(consumeExtOneKeyIdAuthFlowFromUrl()?.freeTrialFeatureId).toBe(
      EPrimeFeatures.BulkSend,
    );
    expect(globalThis.location.hash).toBe('#/');

    // Only free-trial features are trusted from the URL.
    globalThis.history.replaceState(
      null,
      '',
      `#/?${EXT_ONEKEY_ID_AUTH_FLOW_PARAM}=${EExtOneKeyIdAuthFlow.Login}&${EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM}=unknown`,
    );
    expect(
      consumeExtOneKeyIdAuthFlowFromUrl()?.freeTrialFeatureId,
    ).toBeUndefined();
  });

  test('does not trust an unknown provider from the URL', () => {
    globalThis.history.replaceState(
      null,
      '',
      `#/?${EXT_ONEKEY_ID_AUTH_FLOW_PARAM}=${EExtOneKeyIdAuthFlow.LegacyOAuthBind}&${EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM}=unknown`,
    );

    expect(consumeExtOneKeyIdAuthFlowFromUrl()).toEqual({
      flow: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
      provider: undefined,
      toOneKeyIdPageOnLoginSuccess: false,
    });
    expect(globalThis.location.hash).toBe('#/');
  });
});
