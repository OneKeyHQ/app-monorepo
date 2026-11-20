import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
  EXT_ONEKEY_ID_AUTH_FLOW_PARAM,
  EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM,
  EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM,
  EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM,
} from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  type EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { isPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  getExtExpandTabHashParams,
  stripExtExpandTabHashParams,
} from '../../utils/extExpandTabHashParams';

export interface IExtOneKeyIdAuthFlowInfo {
  flow: EExtOneKeyIdAuthFlow;
  toOneKeyIdPageOnLoginSuccess?: boolean;
  provider?: EOAuthSocialLoginProvider;
  // Analytics only: the Prime free trial that asked for the login.
  freeTrialFeatureId?: IPrimeFreeTrialFeatureId;
}

// Only the extension action popup needs the expand-tab handoff: Chrome
// destroys it when it loses focus, so the launchWebAuthFlow-based OAuth flow
// can never complete there (see EXT_ONEKEY_ID_AUTH_FLOW_PARAM in authConsts).
// Side panel and standalone window survive focus loss and run the flow in
// place.
export function shouldRunOneKeyIdAuthInExtExpandTab(): boolean {
  return Boolean(platformEnv.isExtensionUiPopup);
}

export async function redirectOneKeyIdAuthToExtExpandTab({
  flow,
  toOneKeyIdPageOnLoginSuccess,
  provider,
  freeTrialFeatureId,
}: IExtOneKeyIdAuthFlowInfo): Promise<void> {
  const params: Record<string, string> = {
    [EXT_ONEKEY_ID_AUTH_FLOW_PARAM]: flow,
  };
  if (toOneKeyIdPageOnLoginSuccess) {
    params[EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM] = 'true';
  }
  if (provider) {
    params[EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM] = provider;
  }
  if (freeTrialFeatureId) {
    params[EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM] = freeTrialFeatureId;
  }
  // The popup does not need an explicit close: Chrome dismisses it as soon
  // as the newly opened expand tab takes focus.
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({
    path: '/',
    params,
  });
}

export async function redirectKeylessOneKeyIdAuthToExtExpandTab({
  mode,
  provider,
}: {
  mode: EOnboardingV2OneKeyIDLoginMode;
  provider?: EOAuthSocialLoginProvider;
}): Promise<void> {
  const params: Record<string, string> = { mode };
  if (provider) {
    params.provider = provider;
  }
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({
    path: `/onboarding/${EOnboardingPagesV2.OneKeyIDLogin}`,
    params,
  });
}

// Parse the auth-flow params from the expand-tab URL hash
// (ui-expand-tab.html#/?oneKeyIdAuthFlow=login), then strip them via
// history.replaceState so a manual refresh does not re-trigger the flow.
export function consumeExtOneKeyIdAuthFlowFromUrl():
  | IExtOneKeyIdAuthFlowInfo
  | undefined {
  const searchParams = getExtExpandTabHashParams();
  if (!searchParams) {
    return undefined;
  }
  const flow = searchParams.get(EXT_ONEKEY_ID_AUTH_FLOW_PARAM);
  if (
    flow !== EExtOneKeyIdAuthFlow.Login &&
    flow !== EExtOneKeyIdAuthFlow.LegacyOAuthBind
  ) {
    return undefined;
  }
  const toOneKeyIdPageOnLoginSuccess =
    searchParams.get(EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM) === 'true';
  const providerParam = searchParams.get(EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM);
  const provider =
    providerParam === EOAuthSocialLoginProvider.Google ||
    providerParam === EOAuthSocialLoginProvider.Apple
      ? providerParam
      : undefined;
  const featureParam = searchParams.get(
    EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM,
  );
  const freeTrialFeatureId = isPrimeFreeTrialFeatureId(featureParam)
    ? featureParam
    : undefined;

  stripExtExpandTabHashParams([
    EXT_ONEKEY_ID_AUTH_FLOW_PARAM,
    EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM,
    EXT_ONEKEY_ID_AUTH_PROVIDER_PARAM,
    EXT_ONEKEY_ID_AUTH_FREE_TRIAL_FEATURE_PARAM,
  ]);

  return { flow, toOneKeyIdPageOnLoginSuccess, provider, freeTrialFeatureId };
}
