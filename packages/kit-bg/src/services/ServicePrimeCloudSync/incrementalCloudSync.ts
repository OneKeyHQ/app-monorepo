import { isEqual } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ONEKEY_REQUEST_TOKEN_HEADER } from '@onekeyhq/shared/src/request/requestAuthTokenErrorStash';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  ECloudSyncMode,
  type IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
  ICloudSyncServerItem,
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { devSettingsPersistAtom } from '../../states/jotai/atoms';

import {
  canReplaceSettledPublicAccountCache,
  isRetainedHardwareCloudCopy,
} from './cloudSyncCheckUtils';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { splitCloudSyncUploadPostData } from './cloudSyncUploadBatching';
import { keylessCloudSyncApi } from './keylessCloudSyncApi';
import keylessCloudSyncUtils from './keylessCloudSyncUtils';
import { normalizePublicAccountSnapshotRecord } from './publicAccountSnapshot';
import {
  type IWalletTieState,
  recordWalletTieProof,
} from './publicAccountSnapshotWriteGuard';

import type { IWalletNameDeferredObserver } from './CloudSyncFlowManager/CloudSyncFlowManagerBase';
import type { CloudSyncFlowManagerWallet } from './CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import type ServicePrimeCloudSync from './ServicePrimeCloudSync';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { LocalDbBase as ILocalDb } from '../../dbs/local/LocalDbBase';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
  ILocalDBRecordUpdater,
} from '../../dbs/local/types';

type IUploadRequestOptions = { signal: AbortSignal; timeout: number };

export async function runIncrementalCloudSync({
  service,
  params: {
    localItems,
    isFlush,
    setUndefinedTimeToNow,
    encryptedSecurityPasswordR1ForServer,
    isFullDBChecking,
    noDebounceUpload,
  },
  expectedCredential,
  signal,
  isCurrent,
  guard,
  assertSelectedKey,
  uploadItemsWithRequestOptions,
  filterDivergentPendingWalletNames,
  hasDurableDeferredWalletName,
  updateLastSyncTime,
}: {
  service: Pick<
    ServicePrimeCloudSync,
    | 'getActiveSyncMode'
    | 'checkServerStatusWithRequestOptions'
    | 'saveServerSyncItemsToLocal'
    | 'saveServerDeletedItemsToLocal'
  >;
  params: Parameters<ServicePrimeCloudSync['startServerSyncFlowForItems']>[0];
  expectedCredential: ICloudSyncCredential | undefined;
  signal: AbortSignal;
  isCurrent: () => boolean;
  guard: () => void;
  assertSelectedKey: () => Promise<void>;
  uploadItemsWithRequestOptions: (
    params: {
      localItems: IDBCloudSyncItem[];
      isFlush: boolean;
      setUndefinedTimeToNow: boolean;
      syncCredential: ICloudSyncCredential | undefined;
      encryptedSecurityPasswordR1ForServer?: string;
      noDebounceUpload?: boolean;
    },
    requestOptions: IUploadRequestOptions,
    skipLastSyncTime: boolean,
  ) => Promise<ICloudSyncUploadResult | void>;
  filterDivergentPendingWalletNames: (params: {
    items: IDBCloudSyncItem[];
    credential: ICloudSyncCredential | undefined;
    signal: AbortSignal;
    isCurrent: () => boolean;
  }) => Promise<IDBCloudSyncItem[]>;
  hasDurableDeferredWalletName: (
    rows: Map<string, IDBCloudSyncItem>,
    scope: {
      syncCredential: ICloudSyncCredential;
      isCurrent: () => boolean;
    },
  ) => Promise<boolean>;
  updateLastSyncTime: (params: {
    syncMode: ECloudSyncMode;
    isCurrent: () => boolean;
  }) => Promise<void>;
}) {
  const requestOptions = { signal, timeout: 10_000 };
  let stopStampScopeObservation: (() => void) | undefined;
  let stampScopeChanged = false;
  const stampIsCurrent = () => !stampScopeChanged && isCurrent();
  try {
    const ownsLastSyncTime = !isFlush && !isFullDBChecking;
    const readStampScope = () =>
      resolveBeforeTimeout(
        Promise.all([
          service.getActiveSyncMode(),
          getEndpointByServiceName(EServiceEndpointEnum.Prime),
        ]).catch(() => undefined),
        250,
      );
    if (ownsLastSyncTime) {
      try {
        // Endpoint settings can leave and return to the same value during
        // a request. Invalidate only this timestamp, never the data path.
        stopStampScopeObservation = devSettingsPersistAtom.sub(() => {
          stampScopeChanged = true;
        });
      } catch {
        stampScopeChanged = true;
      }
    }
    const stampScope = ownsLastSyncTime ? await readStampScope() : undefined;
    guard();
    const checkRequestItems = localItems.map((item) => ({ ...item }));
    const serverStatus = await service.checkServerStatusWithRequestOptions(
      {
        localItems,
        isFullDBChecking,
      },
      requestOptions,
    );
    guard();
    const syncCredential = expectedCredential;
    await assertSelectedKey();
    guard();

    const spaceId = cloudSyncItemBuilder.getPwdHash(syncCredential);
    const deferredWalletNames = new Map<string, IDBCloudSyncItem>();
    const observeDeferredWalletName: IWalletNameDeferredObserver =
      Object.assign(
        (item: IDBCloudSyncItem) => {
          if (
            isCurrent() &&
            item.serverUploaded &&
            item.data &&
            !item.isDeleted &&
            !item.localSceneUpdated &&
            item.pwdHash === spaceId
          )
            deferredWalletNames.set(item.id, item);
        },
        { observeCanonicalWrite: true as const },
      );
    let completedWork = false;
    let heldOutgoing = false;
    let outboundSettled = true;
    let uploadIncomplete = false;
    if (serverStatus.obsoleted.length || isFlush) {
      const itemsToUpload = localItems.filter((item) =>
        serverStatus.obsoleted.includes(item.id),
      );
      await assertSelectedKey();
      const outgoing = isFlush
        ? itemsToUpload
        : await filterDivergentPendingWalletNames({
            items: itemsToUpload,
            credential: syncCredential,
            signal,
            isCurrent,
          });
      heldOutgoing = outgoing.length < itemsToUpload.length;
      const upload =
        outgoing.length || outgoing.length === itemsToUpload.length
          ? await uploadItemsWithRequestOptions(
              {
                localItems: outgoing,
                isFlush: isFlush ?? false,
                setUndefinedTimeToNow: setUndefinedTimeToNow ?? true,
                syncCredential,
                encryptedSecurityPasswordR1ForServer,
                noDebounceUpload,
              },
              requestOptions,
              ownsLastSyncTime || heldOutgoing,
            )
          : undefined;
      await assertSelectedKey();
      guard();
      const acknowledged = (upload?.created ?? 0) + (upload?.updated ?? 0);
      uploadIncomplete = !isFlush && acknowledged < outgoing.length;
      if (outgoing.length) {
        outboundSettled =
          acknowledged === outgoing.length &&
          Number.isSafeInteger(upload?.created) &&
          Number.isSafeInteger(upload?.updated) &&
          (upload?.created ?? -1) >= 0 &&
          (upload?.updated ?? -1) >= 0;
        completedWork = outboundSettled;
      }
    }

    for (const serverItems of [serverStatus.diff, serverStatus.updated]) {
      guard();
      await assertSelectedKey();
      if (serverItems.length) {
        const applied = await service.saveServerSyncItemsToLocal({
          serverItems,
          shouldSyncToScene: true,
          syncCredential,
          serverPwdHash: serverStatus.pwdHash,
          isCurrent,
          ...(ownsLastSyncTime
            ? {
                skipLastSyncTime: true,
                onWalletNameHistoryDeferred: observeDeferredWalletName,
              }
            : {}),
        });
        completedWork ||= applied === true;
      }
    }
    guard();
    await assertSelectedKey();
    if (serverStatus.deleted.length) {
      const applied = await service.saveServerDeletedItemsToLocal({
        deletedItemIds: serverStatus.deleted,
        requestItems: checkRequestItems,
        shouldSyncToScene: true,
        syncCredential,
        serverPwdHash: serverStatus.pwdHash,
        isCurrent,
        ...(ownsLastSyncTime ? { skipLastSyncTime: true } : {}),
      });
      completedWork ||= applied === true;
    }
    guard();
    if (uploadIncomplete) {
      throw new OneKeyLocalError({
        message: 'Cloud sync upload was only partially acknowledged',
        autoToast: false,
      });
    }
    if (
      ownsLastSyncTime &&
      completedWork &&
      outboundSettled &&
      !heldOutgoing &&
      !!syncCredential &&
      !!spaceId &&
      spaceId === serverStatus.pwdHash &&
      stampScope &&
      stampScope[0] !== ECloudSyncMode.None &&
      !(await hasDurableDeferredWalletName(deferredWalletNames, {
        syncCredential,
        isCurrent: stampIsCurrent,
      })) &&
      stampIsCurrent()
    ) {
      const currentStampScope = await readStampScope();
      if (
        currentStampScope?.[0] !== stampScope[0] ||
        currentStampScope[1] !== stampScope[1]
      )
        return;
      await assertSelectedKey();
      guard();
      await updateLastSyncTime({
        syncMode: stampScope[0],
        isCurrent: stampIsCurrent,
      });
    }
  } finally {
    stopStampScopeObservation?.();
  }
}

const walletVersionFields = [
  'id',
  'name',
  'avatar',
  'firstEvmAddress',
  'associatedDevice',
  'walletNo',
  'type',
  'hash',
  'xfp',
  'passphraseState',
  'isTemp',
  'isMocked',
] as const;
export type IWalletEditVersion = Pick<
  IDBWallet,
  (typeof walletVersionFields)[number]
>;
export type IWalletUploadRetryVersion = IDBCloudSyncItem & {
  retryWallet?: IWalletEditVersion;
};

const MAX_WALLET_UPLOAD_RETRY_VERSIONS = 4;
const MAX_WALLET_UPLOAD_RETRY_ITEMS = 500;
const MAX_WALLET_UPLOAD_RETRY_CACHE_BYTES = 2 * 1024 * 1024;

export function matchesWalletUploadRetryVersion(
  row: IDBCloudSyncItem,
  expected: IDBCloudSyncItem,
) {
  return (
    row.id === expected.id &&
    row.dataType === expected.dataType &&
    row.pwdHash === expected.pwdHash &&
    row.data === expected.data &&
    row.dataTime === expected.dataTime &&
    row.rawKey === expected.rawKey &&
    row.rawData === expected.rawData &&
    row.localSceneUpdated === expected.localSceneUpdated &&
    row.serverUploaded === expected.serverUploaded &&
    row.isDeleted === expected.isDeleted &&
    row.pendingPublicAccountDeletionAt ===
      expected.pendingPublicAccountDeletionAt &&
    row.pendingPublicAccountDeletionHash ===
      expected.pendingPublicAccountDeletionHash
  );
}

export type IWalletUploadRetry = {
  items: Map<string, IWalletUploadRetryVersion[] | null>;
  retainedBytes: number;
  pwdHash: string;
  origin: string;
  isCurrent: () => boolean;
  softwareCredential?: ISoftwareWalletRetryIdentity;
};

export function mergeWalletUploadRetryCandidates({
  pending,
  items,
  pwdHash,
  origin,
  isCurrent,
  softwareCredential,
}: {
  pending: IWalletUploadRetry | undefined;
  items: IWalletUploadRetryVersion[];
  pwdHash: string;
  origin: string;
  isCurrent: () => boolean;
  softwareCredential?: ISoftwareWalletRetryIdentity;
}) {
  const eligible = items.filter(
    (item) =>
      typeof item.dataTime === 'number' &&
      Number.isSafeInteger(item.dataTime) &&
      item.dataTime > 0,
  );
  if (!eligible.length) return;
  const canCoalesce =
    pending?.pwdHash === pwdHash &&
    pending.origin === origin &&
    pending.softwareCredential?.keylessWalletId ===
      softwareCredential?.keylessWalletId &&
    pending.softwareCredential?.signingPublicKey ===
      softwareCredential?.signingPublicKey &&
    pending.softwareCredential?.encryptionKey ===
      softwareCredential?.encryptionKey &&
    pending.isCurrent();
  const retry = canCoalesce
    ? pending
    : {
        items: new Map<string, IWalletUploadRetryVersion[] | null>(),
        retainedBytes: 0,
        pwdHash,
        origin,
        isCurrent,
        softwareCredential,
      };
  eligible.forEach((item) => {
    const previous = retry.items.get(item.id);
    if (
      previous === null ||
      previous?.some((candidate) =>
        matchesWalletUploadRetryVersion(item, candidate),
      )
    )
      return;
    if (!previous && retry.items.size >= MAX_WALLET_UPLOAD_RETRY_ITEMS) return;
    // Approximate worst-case UTF-16 bytes for the retained local data, not
    // just the encrypted wire bytes. Keep the queue bounded across calls.
    const retainedBytes =
      128 +
      2 *
        (item.id.length +
          item.rawKey.length +
          item.pwdHash.length +
          (item.rawData?.length ?? 0) +
          (item.data?.length ?? 0) +
          (item.retryWallet?.name.length ?? 0) +
          (item.retryWallet?.avatar?.length ?? 0));
    if (
      (previous && previous.length >= MAX_WALLET_UPLOAD_RETRY_VERSIONS) ||
      retry.retainedBytes + retainedBytes > MAX_WALLET_UPLOAD_RETRY_CACHE_BYTES
    ) {
      // Never fall back to an earlier candidate when a version wasn't
      // retained. Leave this ID to ordinary reconciliation.
      if (previous) retry.items.set(item.id, null);
      return;
    }
    retry.retainedBytes += retainedBytes;
    retry.items.set(item.id, [...(previous ?? []), { ...item }]);
  });
  return canCoalesce ? undefined : retry;
}

export type ISoftwareWalletRetryIdentity = Pick<
  IKeylessCloudSyncCredential,
  'keylessWalletId' | 'signingPublicKey' | 'encryptionKey' | 'pwdHash'
>;

async function prepareSoftwareWalletRetryRequest<
  T extends Record<string, unknown>,
>({
  backgroundApi,
  expected,
  origin,
  signal,
  isCurrent,
  postData,
  path,
  verify,
}: {
  backgroundApi: IBackgroundApi;
  expected: ISoftwareWalletRetryIdentity;
  origin: string;
  signal: AbortSignal;
  isCurrent: () => boolean;
  postData: T;
  path: '/prime/v1/sync/check' | '/prime/v1/sync/upload';
  verify: (headers: Headers) => Promise<boolean>;
}) {
  const keyless = backgroundApi.serviceKeylessCloudSync;
  const current = () => !signal.aborted && isCurrent();
  const matches = (selected?: IKeylessCloudSyncCredential | null) =>
    current() &&
    !!selected &&
    !selected.source &&
    !selected.hardwareSession &&
    selected.keylessWalletId === expected.keylessWalletId &&
    selected.encryptionKey === expected.encryptionKey &&
    selected.signingPublicKey === expected.signingPublicKey &&
    selected.pwdHash === expected.pwdHash;
  const selectedMatches = async () =>
    matches(
      (await keyless.getLocalMutationSyncCredential())?.keylessCredential,
    );
  if (!current() || !(await selectedMatches())) return undefined;
  const auth = await keyless.getKeylessSyncAuth({ postData });
  if (
    !current() ||
    !auth ||
    auth.publicKey !== expected.signingPublicKey ||
    auth.pwdHash !== expected.pwdHash
  )
    return undefined;
  const client = await backgroundApi.servicePrime.getPrimeClient();
  if (!current() || client.defaults.baseURL !== origin) return undefined;
  return {
    client,
    signatureHeader: auth.signatureHeader,
    postData: auth.fullPostData,
    requestOptions: {
      signal,
      timeout: 8000,
      $oneKeyGuardedWalletRequest: {
        expectedURL: `${origin}${path}`,
        admit: async (headers: Headers) => {
          if (
            !current() ||
            !(await selectedMatches()) ||
            !(await verify(headers)) ||
            !current()
          )
            return undefined;
          // A same-slot replacement can occur while the DB read is
          // pending without an endpoint or selected-ID change. Check the
          // established runtime credential again at actual dispatch.
          return () =>
            matches(
              keyless.getKeylessCloudSyncCredentialCacheSync(
                expected.keylessWalletId,
              ),
            );
        },
      },
    },
  };
}

export async function retrySoftwareWalletUpload({
  backgroundApi,
  expected,
  credential,
  origin,
  signal,
  isCurrent,
  convert,
  matchesVersion,
}: {
  backgroundApi: IBackgroundApi;
  expected: IWalletUploadRetryVersion[];
  credential: ISoftwareWalletRetryIdentity;
  origin: string;
  signal: AbortSignal;
  isCurrent: () => boolean;
  convert: (item: IDBCloudSyncItem) => ICloudSyncServerItem | null;
  matchesVersion: (
    row: IDBCloudSyncItem,
    expected: IDBCloudSyncItem,
  ) => boolean;
}) {
  const {
    localDb,
    simpleDb: { prime },
    servicePrime,
  } = backgroundApi;
  const ownsAuthState = await prime.captureWalletUploadAuthState();
  // The service mutex also covers the session-slot transition before the
  // cached identity projection changes. It is never held across this request.
  const canSend = () =>
    isCurrent() &&
    !servicePrime.authStateWriteMutex.isLocked() &&
    ownsAuthState();
  let checkedAuthContext: string | null | undefined;
  const acceptAuthContext = (headers: Headers, forUpload: boolean) => {
    if (!canSend()) return false;
    // OneKey ID is optional for Software Keyless; compare exact absence or
    // fingerprint the actual outgoing header from both protected requests.
    const token = headers.get(ONEKEY_REQUEST_TOKEN_HEADER);
    const context = token === null ? null : sha512ProSync({ data: token });
    if (!forUpload) checkedAuthContext = context;
    return checkedAuthContext === context;
  };

  const selectExact = async (
    offered: IWalletUploadRetryVersion[],
    verifyPayload = false,
  ) => {
    const eligible = offered.filter(
      ({ retryWallet }) =>
        retryWallet &&
        !retryWallet.isTemp &&
        !retryWallet.isMocked &&
        !retryWallet.associatedDevice &&
        retryWallet.type === WALLET_TYPE_HD,
    );
    if (!eligible.length || !isCurrent()) return [];
    const result = await localDb.readWalletNameUploadRetrySources({
      walletIds: eligible.map(({ retryWallet }) => retryWallet?.id ?? ''),
      itemIds: eligible.map(({ id }) => id),
      deviceIds: [],
    });
    if (!isCurrent()) return [];
    const rows = new Map(result.items.map((row) => [row?.id, row]));
    const wallets = new Map(
      result.wallets.map((wallet) => [wallet?.id, wallet]),
    );
    const matches = eligible.filter((previous) => {
      const local = rows.get(previous.id);
      const wallet = wallets.get(previous.retryWallet?.id);
      return (
        local &&
        wallet &&
        previous.retryWallet &&
        matchesVersion(local, previous) &&
        walletVersionFields.every(
          (field) =>
            (wallet[field] ?? undefined) ===
            (previous.retryWallet?.[field] ?? undefined),
        )
      );
    });
    if (!verifyPayload) return matches;
    const matchesPayload = async (item: IWalletUploadRetryVersion) => {
      const wallet = wallets.get(item.retryWallet?.id);
      if (!wallet?.hash || !item.data) return false;
      try {
        const key = cloudSyncItemBuilder.buildWalletSyncKey({
          dataType: EPrimeCloudSyncDataType.Wallet,
          wallet: { ...wallet, avatarInfo: undefined },
          accountIndex: undefined,
        });
        if (!key || key.key !== item.id || key.rawKey !== item.rawKey)
          return false;
        const raw = JSON.parse(
          await keylessCloudSyncUtils.decryptWithKeylessKey({
            encryptedData: item.data,
            encryptionKey: credential.encryptionKey,
            itemId: item.id,
            dataType: item.dataType,
          }),
        ) as ICloudSyncRawDataJson;
        const parsedAvatar: unknown = wallet.avatar
          ? JSON.parse(wallet.avatar)
          : undefined;
        const avatar =
          parsedAvatar &&
          typeof parsedAvatar === 'object' &&
          Object.keys(parsedAvatar).length
            ? parsedAvatar
            : undefined;
        return (
          raw?.dataType === EPrimeCloudSyncDataType.Wallet &&
          raw.rawKey === key.rawKey &&
          raw.payload?.walletType === WALLET_TYPE_HD &&
          raw.payload.walletHash === wallet.hash &&
          raw.payload.hwDeviceId === undefined &&
          raw.payload.passphraseState === (wallet.passphraseState || '') &&
          raw.payload.name === wallet.name &&
          isEqual(avatar, raw.payload.avatar) &&
          (wallet.firstEvmAddress ?? undefined) === raw.payload.firstEvmAddress
        );
      } catch {
        // Malformed, foreign, or unverifiable items stay durable and pending.
        return false;
      }
    };
    const witnessed: IWalletUploadRetryVersion[] = [];
    for (const item of matches) {
      if (!isCurrent()) return [];
      if (await matchesPayload(item)) witnessed.push(item);
    }
    return witnessed;
  };
  const exact = await selectExact(expected, true);
  if (!exact.length || !isCurrent()) return;
  const request =
    await prepareSoftwareWalletRetryRequest<ICloudSyncCheckServerStatusPostData>(
      {
        backgroundApi,
        path: '/prime/v1/sync/check',
        expected: credential,
        postData: {
          localData: exact.map((row) => ({
            key: row.id,
            dataTimestamp: row.dataTime,
            dataType: row.dataType,
          })),
          onlyCheckLocalDataType: [EPrimeCloudSyncDataType.Wallet],
          nonce: 0,
          pwdHash: credential.pwdHash,
        },
        origin,
        signal,
        isCurrent: canSend,
        verify: async (headers) =>
          acceptAuthContext(headers, false) &&
          (await selectExact(exact)).length === exact.length,
      },
    );
  const response = request && (await keylessCloudSyncApi.checkStatus(request));
  const check =
    response?.status === 200 &&
    (response.request as { oneKeyVerifiedFinalUrl?: string } | undefined)
      ?.oneKeyVerifiedFinalUrl === `${origin}/prime/v1/sync/check` &&
    response.data.code === 0
      ? response.data.data
      : undefined;
  if (
    !check ||
    !isCurrent() ||
    check.reconciliation ||
    check.pwdHash !== credential.pwdHash ||
    !Array.isArray(check.obsoleted) ||
    !Array.isArray(check.deleted) ||
    !Array.isArray(check.diff) ||
    !Array.isArray(check.updated)
  )
    return;
  const obsoleted = new Set(check.obsoleted);
  const contradicted = new Set([
    ...check.deleted,
    ...check.diff.map((row) => row?.key),
    ...check.updated.map((row) => row?.key),
  ]);
  const selected = await selectExact(
    exact.filter((row) => obsoleted.has(row.id) && !contradicted.has(row.id)),
  );
  if (!selected.length || !isCurrent()) return;
  const localData = selected.map(convert).filter((row) => !!row);
  if (!localData.length) return;
  const byId = new Map(selected.map((row) => [row.id, row]));
  for (const batch of splitCloudSyncUploadPostData({
    postData: {
      localData,
      nonce: 0,
      pwdHash: credential.pwdHash,
    },
  })) {
    const attempted = batch.localData.flatMap(({ key }) => {
      const row = byId.get(key);
      return row ? [row] : [];
    });
    if (!attempted.length || !isCurrent()) return;
    const uploadRequest = await prepareSoftwareWalletRetryRequest({
      backgroundApi,
      path: '/prime/v1/sync/upload',
      expected: credential,
      origin,
      signal,
      isCurrent: canSend,
      postData: batch,
      verify: async (headers) =>
        acceptAuthContext(headers, true) &&
        (await selectExact(attempted)).length === attempted.length,
    });
    if (uploadRequest) {
      await keylessCloudSyncApi.upload({
        ...uploadRequest,
        urlPath: '/prime/v1/sync/upload',
      });
    }
    // An aggregate upload response is not a per-record receipt; normal
    // reconciliation still owns pending flags and last-sync time.
  }
}

export async function prepareWalletUploadReadRetry({
  backgroundApi,
  filterDivergentPendingWalletNames,
  batch,
  credential,
  expected,
  isCurrent,
}: {
  backgroundApi: IBackgroundApi;
  filterDivergentPendingWalletNames: (options: {
    items: IDBCloudSyncItem[];
    credential: ICloudSyncCredential | undefined;
    expectedPwdHash: string;
    isCurrent: () => boolean;
    onVerifiedWallet: (
      item: IDBCloudSyncItem,
      wallet: IDBWallet,
      device?: IDBDevice,
    ) => void;
  }) => Promise<IDBCloudSyncItem[]>;
  batch: ICloudSyncUploadPostData;
  credential: IKeylessCloudSyncCredential;
  expected: ReadonlyMap<string, IDBCloudSyncItem>;
  isCurrent: () => boolean;
}) {
  const { localDb, serviceKeylessCloudSync: keyless } = backgroundApi;
  let verifying = true;
  const canVerify = () => verifying && isCurrent();
  const records = await resolveBeforeTimeout(
    (async () => {
      if (!canVerify() || !credential.hardwareSession) return [];
      const selectedSyncCredential =
        await keyless.getLocalMutationSyncCredential();
      const selected = selectedSyncCredential?.keylessCredential;
      if (
        !canVerify() ||
        !selected?.hardwareSession ||
        selected.source?.type !== 'hardware' ||
        credential.source?.type !== 'hardware' ||
        selected.keylessWalletId !== credential.keylessWalletId ||
        selected.source?.credentialId !== credential.source?.credentialId ||
        selected.pwdHash !== credential.pwdHash ||
        selected.pwdHash !== batch.pwdHash ||
        selected.hardwareSession.dekId !== credential.hardwareSession.dekId ||
        selected.hardwareSession.sessionId !==
          credential.hardwareSession.sessionId ||
        selected.encryptionKey !== credential.encryptionKey
      )
        return [];

      const matchesPendingRow = (
        row: IDBCloudSyncItem | null | undefined,
      ): row is IDBCloudSyncItem => {
        if (!row) return false;
        const previous = expected.get(row.id);
        return (
          !!previous &&
          row.dataType === EPrimeCloudSyncDataType.Wallet &&
          row.dataType === previous.dataType &&
          row.pwdHash === batch.pwdHash &&
          row.pwdHash === previous.pwdHash &&
          !!row.data &&
          row.data === previous.data &&
          row.dataTime === previous.dataTime &&
          row.rawKey === previous.rawKey &&
          row.rawData === previous.rawData &&
          row.localSceneUpdated === previous.localSceneUpdated &&
          !row.serverUploaded &&
          !row.isDeleted &&
          !row.pendingPublicAccountDeletionAt &&
          !row.pendingPublicAccountDeletionHash
        );
      };
      const { records: initial } = await localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: batch.localData.map(({ key }) => key),
      });
      if (!canVerify()) return [];
      const authority = new Map<
        string,
        { wallet: IDBWallet; device?: IDBDevice }
      >();
      const verified = await filterDivergentPendingWalletNames({
        items: initial.filter(matchesPendingRow),
        credential: selectedSyncCredential,
        expectedPwdHash: batch.pwdHash,
        isCurrent: canVerify,
        onVerifiedWallet: (item, wallet, device) =>
          authority.set(item.id, { wallet, device }),
      });
      const itemIds = verified
        .filter(({ id }) => authority.has(id))
        .map(({ id }) => id);
      if (!itemIds.length || !canVerify()) return [];
      const proofs = itemIds.flatMap((id) => {
        const proof = authority.get(id);
        return proof ? [proof] : [];
      });
      const { wallets, devices, items } =
        await localDb.readWalletNameUploadRetrySources({
          walletIds: Array.from(new Set(proofs.map(({ wallet }) => wallet.id))),
          deviceIds: Array.from(
            new Set(
              proofs.flatMap(({ device }) => (device ? [device.id] : [])),
            ),
          ),
          itemIds,
        });
      const walletsById = new Map(
        wallets.map((wallet) => [wallet?.id, wallet]),
      );
      const devicesById = new Map(
        devices.map((device) => [device?.id, device]),
      );
      return items.filter(matchesPendingRow).filter((item) => {
        const proof = authority.get(item.id);
        if (!proof) return false;
        const { wallet: old, device } = proof;
        const wallet = walletsById.get(old.id);
        const currentDevice = device && devicesById.get(device.id);
        return (
          !!wallet &&
          !wallet.isTemp &&
          !wallet.isMocked &&
          wallet.name === old.name &&
          wallet.avatar === old.avatar &&
          wallet.firstEvmAddress === old.firstEvmAddress &&
          wallet.type === old.type &&
          wallet.hash === old.hash &&
          wallet.associatedDevice === old.associatedDevice &&
          wallet.passphraseState === old.passphraseState &&
          (!device ||
            (!!currentDevice &&
              currentDevice.deviceId === device.deviceId &&
              currentDevice.deviceType === device.deviceType &&
              // Vendor is derived from the persisted settings.
              currentDevice.settingsRaw === device.settingsRaw))
        );
      });
    })(),
    1500,
  ).finally(() => {
    verifying = false;
  });
  if (!records?.length || !isCurrent()) return undefined;
  const ids = new Set(records.map(({ id }) => id));
  const localData = batch.localData.filter(({ key }) => ids.has(key));
  // The hardware sender evaluates this after all preparation, with no
  // further await before dispatch. Scope changes never use another lane.
  return () => {
    if (!isCurrent())
      throw new OneKeyLocalError({
        message: 'Cloud Wallet upload retry cancelled',
        autoToast: false,
      });
    return { ...batch, localData };
  };
}

const cacheVersionFields = [
  'id',
  'rawKey',
  'rawData',
  'dataType',
  'data',
  'dataTime',
  'isDeleted',
  'pwdHash',
  'localSceneUpdated',
  'serverUploaded',
  'pendingPublicAccountDeletionAt',
  'pendingPublicAccountDeletionHash',
  'remoteHardwareAccountTombstoneProof',
] as const;

async function admitWalletCacheWrite<T>(
  verify: (claim: () => boolean) => Promise<T | undefined>,
) {
  let allowWrite = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => {
      allowWrite = false;
      resolve(undefined);
    }, 250);
  });
  const claim = () => {
    clearTimeout(timeout);
    return allowWrite;
  };
  try {
    return await Promise.race([elapsed, verify(claim)]);
  } finally {
    allowWrite = false;
    clearTimeout(timeout);
  }
}

export async function replaceSettledWalletCacheAfterEdit(
  api: IBackgroundApi,
  {
    candidate,
    previous,
    wallet,
    refillAvatarDevice,
    isCurrent: scopeIsCurrent,
  }: {
    candidate: IDBCloudSyncItem;
    previous: IDBCloudSyncItem;
    wallet: IWalletEditVersion;
    refillAvatarDevice?: IDBDevice;
    isCurrent: () => boolean;
  },
) {
  const { serviceKeylessCloudSync: keyless, localDb } = api;
  let nodeChanged = false;
  const isCurrent = () => !nodeChanged && scopeIsCurrent();
  if (
    !isCurrent() ||
    wallet.isTemp ||
    wallet.isMocked ||
    candidate.dataType !== EPrimeCloudSyncDataType.Wallet ||
    previous.dataType !== candidate.dataType ||
    previous.isDeleted !== false ||
    previous.localSceneUpdated !== true ||
    previous.serverUploaded !== true ||
    previous.pendingPublicAccountDeletionAt !== undefined ||
    previous.pendingPublicAccountDeletionHash ||
    previous.remoteHardwareAccountTombstoneProof ||
    !isRetainedHardwareCloudCopy(previous, candidate.pwdHash) ||
    !previous.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) ||
    !/^[a-f0-9]{64}$/.test(
      previous.pwdHash.slice(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX.length),
    ) ||
    !previous.data ||
    !/^(?:[a-f0-9]{2}){28,}$/i.test(previous.data) ||
    previous.rawKey !== candidate.rawKey ||
    previous.id !== candidate.id ||
    sha512ProSync({ data: candidate.rawKey }) !== candidate.id ||
    !Number.isSafeInteger(previous.dataTime) ||
    !Number.isSafeInteger(candidate.dataTime) ||
    (previous.dataTime ?? 0) <= 0 ||
    (candidate.dataTime ?? 0) <= (previous.dataTime ?? 0)
  )
    return;
  const stop = devSettingsPersistAtom.sub(() => {
    nodeChanged = true;
  });
  try {
    const admission = await resolveBeforeTimeout(
      (async () => {
        const credential = await keyless.getLocalMutationSyncCredential();
        const selected = credential?.keylessCredential;
        const session = selected?.hardwareSession;
        if (
          !isCurrent() ||
          selected?.source?.type !== 'hardware' ||
          selected.pwdHash !== candidate.pwdHash ||
          !session?.boundBaseURL ||
          session.boundBaseURL !==
            (await keyless.getHardwareWalletRetryOrigin()) ||
          !isCurrent()
        )
          return undefined;
        const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
          item: { ...candidate },
          syncCredential: credential,
        });
        if (rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet)
          return undefined;
        const manager = api.servicePrimeCloudSync.syncManagers.wallet;
        const match = await manager.findWalletSyncTargetReadOnly({
          payload: rawDataJson.payload,
          isCurrent,
        });
        if (match?.target.wallet.id !== wallet.id || !isCurrent())
          return undefined;
        if (
          (match.device && wallet.associatedDevice !== match.device.id) ||
          (refillAvatarDevice &&
            (!match.device ||
              match.device.id !== refillAvatarDevice.id ||
              match.device.deviceId !== refillAvatarDevice.deviceId ||
              match.device.deviceType !== refillAvatarDevice.deviceType ||
              match.device.features !== refillAvatarDevice.features ||
              match.device.deviceState !== refillAvatarDevice.deviceState ||
              match.device.settingsRaw !== refillAvatarDevice.settingsRaw))
        )
          return undefined;
        const key = await manager.buildSyncKeyInfo({ target: match.target });
        if (key?.key !== candidate.id || key.rawKey !== candidate.rawKey)
          return undefined;
        return { match, selected };
      })(),
      1500,
    );
    if (!admission || !isCurrent()) return;
    const committed = await keyless.runWithCloudSyncKeyLock(() =>
      admitWalletCacheWrite((claim) =>
        keyless.runWithVerifiedHardwareAccountArchiveSession(
          admission.selected,
          () => {
            if (!isCurrent() || !claim()) return Promise.resolve(false);
            return localDb.withTransaction(
              EIndexedDBBucketNames.account,
              async (tx) => {
                const [currentWallet] = await localDb.txGetWallet({
                  tx,
                  walletId: wallet.id,
                });
                const [currentCache] = await localDb.txGetRecordById({
                  tx,
                  name: ELocalDBStoreNames.CloudSyncItem,
                  id: previous.id,
                });
                const device = admission.match.device;
                if (device) {
                  const [currentDevice] = await localDb.txGetRecordById({
                    tx,
                    name: ELocalDBStoreNames.Device,
                    id: device.id,
                  });
                  if (
                    !currentDevice ||
                    currentDevice.deviceId !== device.deviceId ||
                    currentDevice.deviceType !== device.deviceType ||
                    currentDevice.settingsRaw !== device.settingsRaw ||
                    (refillAvatarDevice &&
                      (currentDevice.features !== device.features ||
                        currentDevice.deviceState !== device.deviceState))
                  )
                    return false;
                }
                if (
                  !isCurrent() ||
                  !currentWallet ||
                  !currentCache ||
                  !walletVersionFields.every(
                    (field) => currentWallet[field] === wallet[field],
                  ) ||
                  !cacheVersionFields.every(
                    (field) => currentCache[field] === previous[field],
                  )
                )
                  return false;
                await localDb.txAddAndUpdateFreshSyncItems({
                  tx,
                  items: [candidate],
                  skipUploadToServer: true,
                });
                if (!isCurrent())
                  throw new OneKeyLocalError({
                    message: 'Wallet sync selection changed',
                    autoToast: false,
                  });
                return true;
              },
              { skipCloudCredentialWarmup: true, confirmRollbackOnError: true },
            );
          },
        ),
      ),
    );
    if (committed && isCurrent())
      await api.servicePrimeCloudSync.startServerSyncFlowSilently({
        callerName: 'Wallet metadata edit',
        localMutation: true,
      });
  } finally {
    stop();
  }
}

export async function probeDurableWalletNameDeferral(
  localDb: Pick<ILocalDb, 'getRecordsByIds'>,
  wallet: CloudSyncFlowManagerWallet,
  deferredWalletNames: Map<string, IDBCloudSyncItem>,
  scope?: {
    syncCredential: ICloudSyncCredential;
    isCurrent: () => boolean;
  },
) {
  if (!deferredWalletNames.size) return false;
  try {
    const check = await resolveBeforeTimeout(
      localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: [...deferredWalletNames.keys()],
      }),
      1500,
    );
    const newerPending: IDBCloudSyncItem[] = [];
    const stillDeferred =
      !check ||
      check.records.length !== deferredWalletNames.size ||
      check.records.some((current) => {
        if (!current) return false;
        const observed = deferredWalletNames.get(current.id);
        if (!observed) return true;
        if (
          current.dataType !== EPrimeCloudSyncDataType.Wallet ||
          current.pwdHash !== observed.pwdHash
        )
          return true;
        if (
          current.data === observed.data &&
          current.dataTime === observed.dataTime &&
          !current.isDeleted
        )
          return !current.serverUploaded || !current.localSceneUpdated;
        const timestamp = current.dataTime;
        const isVersionNewer = !!(
          (current.data || current.isDeleted) &&
          typeof timestamp === 'number' &&
          Number.isSafeInteger(timestamp) &&
          timestamp > (observed.dataTime ?? 0)
        );
        if (
          isVersionNewer &&
          scope &&
          current.serverUploaded === true &&
          current.localSceneUpdated === false &&
          !current.isDeleted &&
          current.data
        )
          newerPending.push(current);
        return !isVersionNewer;
      });
    if (stillDeferred || !scope || !newerPending.length) return stillDeferred;
    // Server storage alone does not prove the new ciphertext is usable
    // Wallet data for this selected source and target. Scoped callers can
    // prove it here; full reconciliation keeps its supersession rules.
    let expired = false;
    const isProbeCurrent = () => !expired && scope.isCurrent();
    try {
      const verified = await resolveBeforeTimeout(
        (async () => {
          for (const item of newerPending) {
            if (!isProbeCurrent()) return false;
            try {
              const { rawDataJson } =
                await cloudSyncItemBuilder.decryptSyncItem({
                  item: { ...item },
                  syncCredential: scope.syncCredential,
                });
              if (
                !isProbeCurrent() ||
                rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet ||
                typeof rawDataJson.payload?.name !== 'string' ||
                !rawDataJson.payload.name.trim() ||
                typeof rawDataJson.rawKey !== 'string' ||
                !rawDataJson.rawKey ||
                wallet.rawKeyToHashKey(rawDataJson.rawKey) !== item.id
              )
                // eslint-disable-next-line no-continue -- Check other authenticated candidates.
                continue;
              const match = await wallet.findWalletSyncTargetReadOnly({
                payload: rawDataJson.payload,
                isCurrent: isProbeCurrent,
              });
              if (!isProbeCurrent()) return false;
              const target = match?.target;
              if (
                !target?.wallet.name.trim() ||
                target.wallet.name === rawDataJson.payload.name
              )
                // eslint-disable-next-line no-continue -- Check other authenticated candidates.
                continue;
              const key = await wallet.buildSyncKeyInfo({ target });
              if (!isProbeCurrent()) return false;
              if (key?.key === item.id && key.rawKey === rawDataJson.rawKey)
                return true;
            } catch (error) {
              errorUtils.autoPrintErrorIgnore(error);
            }
          }
          return false;
        })(),
        1500,
      );
      return verified === true;
    } finally {
      expired = true;
    }
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
    return true;
  }
}

// Only authenticated, explicit server versions enter this preflight. A bare
// deletion ACK has no time and must keep its normal request-version CAS.
export async function verifyWalletTies(
  wallet: CloudSyncFlowManagerWallet,
  { requested, wire }: IWalletTieState,
  rows: IDBCloudSyncItem[],
  credential: ICloudSyncCredential,
  isCurrent: () => boolean,
): Promise<void> {
  if (!isCurrent()) return;
  const observed = new Map<string, ICloudSyncServerItem | null>();
  for (const row of wire) {
    const previous = requested.get(row.key);
    if (
      row.dataType === EPrimeCloudSyncDataType.Wallet &&
      row.dataTimestamp === previous?.dataTime &&
      row.dataTimestamp !== undefined
    ) {
      const earlier = observed.get(row.key);
      if (earlier === undefined) observed.set(row.key, row);
      else if (
        !earlier ||
        earlier.isDeleted !== row.isDeleted ||
        earlier.data !== row.data ||
        (earlier.pwdHash || previous?.pwdHash) !==
          (row.pwdHash || previous?.pwdHash)
      )
        observed.set(row.key, null);
    }
  }

  let next = 0;
  const verify = async () => {
    while (isCurrent() && next < rows.length) {
      const incoming = rows[next];
      next += 1;
      const previous = requested.get(incoming.id);
      if (
        !observed.get(incoming.id) ||
        previous?.dataType !== EPrimeCloudSyncDataType.Wallet ||
        previous.pwdHash !== incoming.pwdHash ||
        previous.dataTime !== incoming.dataTime ||
        !incoming.data ||
        incoming.data.length > 64 * 1024
      )
        // eslint-disable-next-line no-continue
        continue;
      try {
        const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
          item: { ...incoming, rawData: '', rawDataJson: undefined },
          syncCredential: credential,
        });
        if (
          isCurrent() &&
          rawDataJson?.dataType === EPrimeCloudSyncDataType.Wallet &&
          !!rawDataJson.payload &&
          typeof rawDataJson.rawKey === 'string' &&
          !!rawDataJson.rawKey &&
          sha512ProSync({ data: rawDataJson.rawKey }) === incoming.id
        ) {
          const match = await wallet.findWalletSyncTargetReadOnly({
            payload: rawDataJson.payload,
            isCurrent,
          });
          const key =
            match && isCurrent()
              ? await wallet.buildSyncKeyInfo({ target: match.target })
              : undefined;
          if (
            isCurrent() &&
            key?.key === incoming.id &&
            key.rawKey === rawDataJson.rawKey
          )
            recordWalletTieProof(incoming, previous);
        }
      } catch {
        // An unverified equal-time cloud value must not overwrite the local row.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, rows.length) }, verify));
}

export async function probeAccountHandoffs(
  db: ILocalDb,
  candidates: IDBCloudSyncItem[],
  syncCredential: ICloudSyncCredential | undefined,
  canContinue: () => boolean,
  foreignAccountsByWireId: Map<string, IDBCloudSyncItem>,
  collisionCandidates: IDBCloudSyncItem[],
): Promise<void> {
  if (!canContinue()) return;
  const { records } = await db.getRecordsByIds({
    name: ELocalDBStoreNames.CloudSyncItem,
    ids: candidates.map((item) => item.id),
  });
  if (!canContinue()) return;
  const byId = new Map(records.map((record) => [record?.id, record]));
  let next = 0;
  const verify = async () => {
    while (canContinue() && next < candidates.length) {
      const item = candidates[next];
      next += 1;
      const previous = byId.get(item.id);
      if (
        !previous ||
        !canReplaceSettledPublicAccountCache(previous, item, previous.rawKey)
      )
        // eslint-disable-next-line no-continue
        continue;
      try {
        const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
          item: { ...item, rawData: '', rawDataJson: undefined },
          syncCredential,
        });
        const { rawKey } = normalizePublicAccountSnapshotRecord(rawDataJson);
        if (canContinue() && rawKey === previous.rawKey) {
          foreignAccountsByWireId.set(previous.id, { ...previous });
          collisionCandidates.push({ ...item, rawKey });
        }
      } catch {
        // Leave unverified versions untouched; healthy records continue.
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(8, candidates.length) }, verify),
  );
}

export async function downloadCloudDebugRows(
  service: Pick<
    ServicePrimeCloudSync,
    | 'getSyncCredentialSafe'
    | 'apiDownloadItems'
    | 'convertServerItemToLocalItem'
  >,
  includeDeleted?: boolean,
): Promise<IDBCloudSyncItem[]> {
  const syncCredential = await service.getSyncCredentialSafe();
  const { serverData: items, pwdHash } = await service.apiDownloadItems({
    includeDeleted,
  });
  return decodeCloudSyncDebugRows(items, (serverItem, shouldDecrypt) =>
    service.convertServerItemToLocalItem({
      serverItem,
      shouldDecrypt,
      syncCredential,
      serverPwdHash: pwdHash,
    }),
  );
}

async function decodeCloudSyncDebugRows(
  items: ICloudSyncServerItem[],
  convert: (
    item: ICloudSyncServerItem,
    decrypt: boolean,
  ) => Promise<IDBCloudSyncItem | null>,
): Promise<IDBCloudSyncItem[]> {
  const localItems: IDBCloudSyncItem[] = [];
  let failedCount = 0;
  for (const item of items) {
    try {
      const localItem = await convert(item, true);
      if (localItem) {
        localItems.push(localItem);
      }
    } catch {
      failedCount += 1;
      const localItem = await convert(item, false);
      if (localItem) {
        localItems.push(localItem);
      }
    }
  }
  console.log('decryptAllServerSyncItems', {
    count: items.length,
    failedCount,
  });
  return localItems.toSorted((a, b) => a.id.localeCompare(b.id));
}

// Called only through the existing developer-only background methods.
export async function updateDemoSyncItems(
  db: ILocalDb,
  updater: ILocalDBRecordUpdater<ELocalDBStoreNames.CloudSyncItem>,
) {
  const { syncItems } = await db.getAllSyncItems();
  await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    await db.txUpdateRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      ids: syncItems.map((item) => item.id),
      updater,
    });
  });
}

export async function cleanupCheckedWalletTombstones(
  db: ILocalDb,
  keys: string[],
  sources: IDBCloudSyncItem[],
  tie: IWalletTieState,
) {
  const candidates = new Set(keys);
  const expectedItems = sources.filter((row) => {
    const accepted = tie.accepted.get(row.id);
    return (
      candidates.has(row.id) &&
      accepted?.isDeleted === true &&
      row.isDeleted === true &&
      accepted.dataType === EPrimeCloudSyncDataType.Wallet &&
      row.dataType === accepted.dataType &&
      row.pwdHash === accepted.pwdHash &&
      row.dataTime === accepted.dataTime &&
      row.data === accepted.data &&
      row.serverUploaded === true
    );
  });
  const scoped = new Set(expectedItems.map((item) => item.id));
  const ordinary = keys.filter((id) => !scoped.has(id));
  if (ordinary.length)
    await db.removeCloudSyncPoolItems({
      keys: ordinary,
      expectedItems: sources,
    });
  if (!expectedItems.length || !tie.isCurrent()) return;
  await db.removeCloudSyncPoolItems({
    keys: [...scoped],
    expectedItems,
    receipt: {
      isCurrent: tie.isCurrent,
      onCommitted: (removed) => {
        for (const id of removed) tie.cleaned.add(id);
      },
    },
  });
}
