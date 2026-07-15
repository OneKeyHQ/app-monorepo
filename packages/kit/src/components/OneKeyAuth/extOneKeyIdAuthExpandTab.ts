import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EExtOneKeyIdAuthFlow,
  EXT_ONEKEY_ID_AUTH_FLOW_PARAM,
  EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM,
} from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IExtOneKeyIdAuthFlowInfo {
  flow: EExtOneKeyIdAuthFlow;
  toOneKeyIdPageOnLoginSuccess?: boolean;
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
}: IExtOneKeyIdAuthFlowInfo): Promise<void> {
  const params: Record<string, string> = {
    [EXT_ONEKEY_ID_AUTH_FLOW_PARAM]: flow,
  };
  if (toOneKeyIdPageOnLoginSuccess) {
    params[EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM] = 'true';
  }
  // The popup does not need an explicit close: Chrome dismisses it as soon
  // as the newly opened expand tab takes focus.
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({
    path: '/',
    params,
  });
}

// Parse the auth-flow params from the expand-tab URL hash
// (ui-expand-tab.html#/?oneKeyIdAuthFlow=login), then strip them via
// history.replaceState so a manual refresh does not re-trigger the flow.
export function consumeExtOneKeyIdAuthFlowFromUrl():
  | IExtOneKeyIdAuthFlowInfo
  | undefined {
  if (!platformEnv.isExtensionUiExpandTab) {
    return undefined;
  }
  const hash = globalThis.location?.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) {
    return undefined;
  }
  const searchParams = new URLSearchParams(hash.slice(queryIndex + 1));
  const flow = searchParams.get(EXT_ONEKEY_ID_AUTH_FLOW_PARAM);
  if (
    flow !== EExtOneKeyIdAuthFlow.Login &&
    flow !== EExtOneKeyIdAuthFlow.LegacyOAuthBind
  ) {
    return undefined;
  }
  const toOneKeyIdPageOnLoginSuccess =
    searchParams.get(EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM) === 'true';

  try {
    searchParams.delete(EXT_ONEKEY_ID_AUTH_FLOW_PARAM);
    searchParams.delete(EXT_ONEKEY_ID_AUTH_TO_PAGE_PARAM);
    const restQuery = searchParams.toString();
    const newHash = `${hash.slice(0, queryIndex)}${
      restQuery ? `?${restQuery}` : ''
    }`;
    globalThis.history?.replaceState?.(
      globalThis.history?.state ?? null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}${
        newHash || '#/'
      }`,
    );
  } catch {
    // URL cleanup is best-effort only; the flow info is already extracted.
  }

  return { flow, toOneKeyIdPageOnLoginSuccess };
}
