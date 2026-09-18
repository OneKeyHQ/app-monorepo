import type { IOneKeyIdLoginWithLocalKeylessPrepareResult } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

type IOneKeyIdLegacyOAuthBindCache = {
  onekeyUserId: string;
  prepareResult?: IOneKeyIdLoginWithLocalKeylessPrepareResult;
  credentialReady?: boolean;
  shouldShowBindPrompt?: boolean;
};

type IOneKeyIdLegacyOAuthBindCachePatch = Omit<
  IOneKeyIdLegacyOAuthBindCache,
  'onekeyUserId'
>;

let bindCache: IOneKeyIdLegacyOAuthBindCache | undefined;

function isCachedForUser(onekeyUserId?: string): boolean {
  return Boolean(onekeyUserId && bindCache?.onekeyUserId === onekeyUserId);
}

function readUnpatchedCacheValue<T>(
  sameUser: boolean,
  currentValue: T | undefined,
): T | undefined {
  return sameUser ? currentValue : undefined;
}

function writeBindCache(
  onekeyUserId: string,
  patch: IOneKeyIdLegacyOAuthBindCachePatch,
) {
  const sameUser = isCachedForUser(onekeyUserId);
  bindCache = {
    onekeyUserId,
    prepareResult:
      'prepareResult' in patch
        ? patch.prepareResult
        : readUnpatchedCacheValue(sameUser, bindCache?.prepareResult),
    credentialReady:
      'credentialReady' in patch
        ? patch.credentialReady
        : readUnpatchedCacheValue(sameUser, bindCache?.credentialReady),
    shouldShowBindPrompt:
      'shouldShowBindPrompt' in patch
        ? patch.shouldShowBindPrompt
        : readUnpatchedCacheValue(sameUser, bindCache?.shouldShowBindPrompt),
  };
}

export function getCachedLocalKeylessPrepareResult(
  onekeyUserId?: string,
): IOneKeyIdLoginWithLocalKeylessPrepareResult | null {
  if (!isCachedForUser(onekeyUserId) || !bindCache?.prepareResult) {
    return null;
  }
  return bindCache.prepareResult;
}

export function rememberLocalKeylessPrepareResult({
  onekeyUserId,
  result,
}: {
  onekeyUserId: string;
  result: IOneKeyIdLoginWithLocalKeylessPrepareResult;
}) {
  writeBindCache(onekeyUserId, { prepareResult: result });
}

export function getCachedKeylessCredentialReadyForBind(
  onekeyUserId?: string,
): boolean {
  return Boolean(isCachedForUser(onekeyUserId) && bindCache?.credentialReady);
}

export function rememberKeylessCredentialReadyForBind(onekeyUserId: string) {
  writeBindCache(onekeyUserId, { credentialReady: true });
}

export function getCachedShouldShowBindPrompt(
  onekeyUserId?: string,
): boolean | undefined {
  if (!isCachedForUser(onekeyUserId)) {
    return undefined;
  }
  return bindCache?.shouldShowBindPrompt;
}

export function rememberShouldShowBindPrompt({
  onekeyUserId,
  shouldShow,
}: {
  onekeyUserId: string;
  shouldShow: boolean;
}) {
  writeBindCache(onekeyUserId, { shouldShowBindPrompt: shouldShow });
}

export function clearOneKeyIdLegacyOAuthBindCaches() {
  bindCache = undefined;
}
