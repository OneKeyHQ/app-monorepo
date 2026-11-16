import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isAllowedEtherFiAsset } from '@onekeyhq/shared/src/utils/etherFiVaults';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { waitForCurrentAction } from '../utils/waitForCurrentAction';

import { etherFiDepositRecovery } from './etherFiDepositRecovery';

import type { IEtherFiDepositRecoveryScope } from './etherFiDepositRecovery';

export async function getEtherFiNativeRecoveryBalance({
  scope,
  amount,
  isCurrent,
}: {
  scope: IEtherFiDepositRecoveryScope;
  amount: string;
  isCurrent: () => boolean;
}) {
  const { accountId, networkId, accountAddress } = scope;
  const checkAccount = async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    if (
      !isCurrent() ||
      account.address.toLowerCase() !== accountAddress.toLowerCase()
    ) {
      throw new OneKeyLocalError('EtherFi recovery account changed');
    }
  };
  await checkAccount();
  const batches = await backgroundApiProxy.serviceToken.fetchTokensDetailsBatch(
    {
      accountId,
      networkId,
      contractList: [EthereumWETH],
      queries: [{ accountAddress }],
    },
  );
  await checkAccount();
  const matchingBatches = batches.filter(
    (item) =>
      item.accountAddress.toLowerCase() === accountAddress.toLowerCase(),
  );
  const tokens =
    matchingBatches.length === 1
      ? matchingBatches[0].tokens.filter(
          (item) =>
            item.info.address.toLowerCase() === EthereumWETH.toLowerCase() &&
            item.info.decimals === 18 &&
            !item.info.isNative &&
            item.info.networkId === networkId,
        )
      : [];
  const token = tokens.length === 1 ? tokens[0] : undefined;
  const rawBalance = new BigNumber(token?.balance ?? NaN);
  const parsedBalance = new BigNumber(token?.balanceParsed ?? NaN);
  if (
    !token ||
    !rawBalance.isFinite() ||
    !rawBalance.isInteger() ||
    rawBalance.isNegative() ||
    !parsedBalance.isFinite() ||
    parsedBalance.isNegative() ||
    !parsedBalance.shiftedBy(18).eq(rawBalance) ||
    parsedBalance.lt(amount)
  )
    throw new OneKeyLocalError('EtherFi recovery WETH balance is unavailable');
  return token;
}

export async function prepareEtherFiNativeDepositRecovery({
  id,
  asset,
  isCurrent,
}: {
  id: symbol;
  asset: IEarnTokenItem;
  isCurrent: () => boolean;
}) {
  const record = etherFiDepositRecovery.get(id);
  if (
    !record ||
    !record.detached ||
    !['ready', 'failed'].includes(record.status) ||
    (record.status === 'failed' && record.phase === 'wrap') ||
    !isAllowedEtherFiAsset({
      vault: record.scope.vault,
      networkId: record.scope.networkId,
      direction: 'stake',
      token: asset.info,
    }) ||
    asset.info.address.toLowerCase() !== EthereumWETH.toLowerCase()
  )
    throw new OneKeyLocalError('EtherFi recovery asset is unavailable');
  const token = await getEtherFiNativeRecoveryBalance({
    scope: record.scope,
    amount: record.amount,
    isCurrent,
  });
  const current = etherFiDepositRecovery.get(id);
  if (
    !isCurrent() ||
    !current ||
    current.status !== record.status ||
    current.attemptId !== record.attemptId ||
    !current.detached
  ) {
    throw new OneKeyLocalError('EtherFi recovery context changed');
  }
  const owner = etherFiDepositRecovery.claim(id);
  if (!owner) throw new OneKeyLocalError('EtherFi recovery is already open');
  if (
    record.status === 'failed' &&
    !etherFiDepositRecovery.prepareRetry(id, owner)
  ) {
    etherFiDepositRecovery.detach(id, owner);
    throw new OneKeyLocalError('EtherFi recovery cannot retry');
  }
  return {
    id,
    owner,
    renderKey: record.renderKey,
    scope: record.scope,
    amount: record.amount,
    balance: token.balance,
    balanceParsed: token.balanceParsed,
    asset,
  };
}

export async function refreshEtherFiNativeDepositRecovery(id: symbol) {
  const record = etherFiDepositRecovery.get(id);
  if (!record?.txid || !record.attemptId || record.status !== 'confirming')
    return 'pending' as const;
  const status =
    await backgroundApiProxy.serviceStaking.checkEtherFiNativeDepositTx({
      ...record.scope,
      amount: record.amount,
      phase: record.phase,
      txid: record.txid,
    });
  if (status === 'success' || status === 'failed') {
    etherFiDepositRecovery.recordFinal(
      id,
      record.attemptId,
      record.txid,
      status,
    );
  }
  return status;
}

export function useEtherFiNativeDepositRecovery(
  scope?: IEtherFiDepositRecoveryScope,
  includeAttached = false,
) {
  const accountId = scope?.accountId;
  const accountAddress = scope?.accountAddress;
  const networkId = scope?.networkId;
  const vault = scope?.vault;
  const currentScope = useMemo(
    () =>
      accountId && accountAddress && networkId && vault
        ? { accountId, accountAddress, networkId, vault }
        : undefined,
    [accountId, accountAddress, networkId, vault],
  );
  const [snapshot, setSnapshot] = useState(() => ({
    scope: currentScope,
    records: currentScope
      ? etherFiDepositRecovery.list(currentScope, includeAttached)
      : [],
  }));
  useEffect(() => {
    const update = () =>
      setSnapshot({
        scope: currentScope,
        records: currentScope
          ? etherFiDepositRecovery.list(currentScope, includeAttached)
          : [],
      });
    const unsubscribe = etherFiDepositRecovery.subscribe(update);
    update();
    return unsubscribe;
  }, [currentScope, includeAttached]);
  return snapshot.scope === currentScope ? snapshot.records : [];
}

export function useEtherFiNativeRecoveryController({
  scope,
  assets,
  selectedAsset,
  setSelectedAsset,
}: {
  scope?: IEtherFiDepositRecoveryScope;
  assets: IEarnTokenItem[];
  selectedAsset?: IEarnTokenItem;
  setSelectedAsset: (asset: IEarnTokenItem) => void;
}) {
  const intl = useIntl();
  const allRecords = useEtherFiNativeDepositRecovery(scope, true);
  const records = useMemo(
    () => allRecords.filter((record) => record.detached),
    [allRecords],
  );
  const [active, setActive] =
    useState<Awaited<ReturnType<typeof prepareEtherFiNativeDepositRecovery>>>();
  const [loading, setLoading] = useState(false);
  const resumeLock = useRef<symbol | undefined>(undefined);
  const requestRef = useRef<AbortController | undefined>(undefined);
  const activeRef = useRef(active);
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);
  const accountId = scope?.accountId;
  const accountAddress = scope?.accountAddress;
  const networkId = scope?.networkId;
  const vault = scope?.vault;
  const selectedAddress = selectedAsset?.info.address;
  useLayoutEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(false);
    return () => controller.abort();
  }, [accountId, accountAddress, networkId, vault, selectedAddress]);
  useLayoutEffect(
    () => () => {
      const current = activeRef.current;
      if (
        current &&
        current.scope.accountId === accountId &&
        current.scope.accountAddress.toLowerCase() ===
          accountAddress?.toLowerCase() &&
        current.scope.networkId === networkId &&
        current.scope.vault.toLowerCase() === vault?.toLowerCase()
      )
        etherFiDepositRecovery.detach(current.id, current.owner);
    },
    [accountId, accountAddress, networkId, vault],
  );
  useEffect(() => {
    if (
      active &&
      selectedAddress?.toLowerCase() !== EthereumWETH.toLowerCase()
    ) {
      etherFiDepositRecovery.detach(active.id, active.owner);
      setActive(undefined);
    }
  }, [active, selectedAddress]);
  const resume = useCallback(
    async (id: symbol) => {
      if (resumeLock.current) return;
      const signal = requestRef.current?.signal;
      const asset = assets.find(
        (item) =>
          item.info.address.toLowerCase() === EthereumWETH.toLowerCase() &&
          !item.info.isNative &&
          item.info.decimals === 18,
      );
      if (!signal || signal.aborted || !asset) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return;
      }
      const lease = Symbol('EtherFi recovery request');
      resumeLock.current = lease;
      setLoading(true);
      try {
        const prepared = await waitForCurrentAction(
          prepareEtherFiNativeDepositRecovery({
            id,
            asset,
            isCurrent: () => !signal.aborted,
          }),
          signal,
        );
        if (!prepared) return;
        if (signal.aborted) {
          etherFiDepositRecovery.detach(prepared.id, prepared.owner);
          return;
        }
        const previous = activeRef.current;
        if (previous && previous.id !== prepared.id) {
          etherFiDepositRecovery.detach(previous.id, previous.owner);
        }
        activeRef.current = prepared;
        setActive(prepared);
        setSelectedAsset({
          ...asset,
          balance: prepared.balance,
          balanceParsed: prepared.balanceParsed,
        });
      } catch {
        if (!signal.aborted)
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
      } finally {
        if (resumeLock.current === lease) {
          resumeLock.current = undefined;
          if (!signal.aborted) setLoading(false);
        }
      }
    },
    [assets, intl, setSelectedAsset],
  );
  const abandon = useCallback(() => {
    if (active) etherFiDepositRecovery.detach(active.id, active.owner);
    setActive(undefined);
  }, [active]);
  const storedActive = active
    ? etherFiDepositRecovery.get(active.id)
    : undefined;
  const currentActive =
    active &&
    storedActive &&
    !storedActive.detached &&
    storedActive.owner === active.owner &&
    active.scope.accountId === accountId &&
    active.scope.accountAddress.toLowerCase() ===
      accountAddress?.toLowerCase() &&
    active.scope.networkId === networkId &&
    active.scope.vault.toLowerCase() === vault?.toLowerCase() &&
    selectedAddress?.toLowerCase() === EthereumWETH.toLowerCase()
      ? active
      : undefined;
  return {
    records,
    allRecords,
    active: currentActive,
    loading,
    resume,
    abandon,
  };
}
