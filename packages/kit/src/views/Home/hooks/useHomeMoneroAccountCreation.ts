import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ComponentProps } from 'react';

import type { LazyAccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/LazyAccountSelectorCreateAddressButton';
import { useHomeMoneroEnableRequestAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import type { IHomeMoneroEnableRequest } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { IMPL_XMR } from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  captureEmptyMoneroPortfolioDraft,
  handoffEmptyMoneroPortfolioDraft,
  subscribeMoneroPortfolioDraft,
} from '../../ChainSelector/components/UnifiedNetworkSelectorV2/moneroPortfolioDraft';

export function useHomeMoneroAccountCreation() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { wallet, indexedAccount, network } = activeAccount;
  const [, setEnableRequest] = useHomeMoneroEnableRequestAtom();
  const walletId = wallet?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = network?.id;
  const enableAfterCreate = Boolean(
    walletId &&
    accountUtils.isHdWallet({ walletId }) &&
    !wallet?.isTemp &&
    networkId &&
    networkUtils.getNetworkImpl({ networkId }) === IMPL_XMR,
  );
  // The selected account appears during creation, so only its wallet/index/network own this handoff.
  const owner = useMemo(
    () => ({ walletId, indexedAccountId, networkId, mounted: true }),
    [walletId, indexedAccountId, networkId],
  );
  const getEmptyPortfolioDraft = useCallback(
    () =>
      enableAfterCreate && walletId && !indexedAccountId
        ? captureEmptyMoneroPortfolioDraft(walletId)
        : undefined,
    [enableAfterCreate, indexedAccountId, walletId],
  );
  const emptyPortfolioDraft = useSyncExternalStore(
    subscribeMoneroPortfolioDraft,
    getEmptyPortfolioDraft,
    getEmptyPortfolioDraft,
  );
  const ownerRef = useRef(owner);
  const initialOwnerRef = useRef<typeof owner | undefined>(undefined);
  const pendingCreationRef = useRef<
    | {
        owner: typeof owner;
        emptyPortfolioDraft: typeof emptyPortfolioDraft;
        request: IHomeMoneroEnableRequest;
      }
    | undefined
  >(undefined);
  if (ownerRef.current !== owner) {
    const previous = ownerRef.current;
    // Active-account hydration may precede or follow onCreateDone. Allow only
    // the first index transition; any further selection invalidates the handoff.
    initialOwnerRef.current =
      previous.walletId === walletId &&
      previous.networkId === networkId &&
      !previous.indexedAccountId &&
      indexedAccountId
        ? previous
        : undefined;
  }
  ownerRef.current = owner;
  useLayoutEffect(() => {
    owner.mounted = true;
    return () => {
      owner.mounted = false;
      if (ownerRef.current === owner) {
        pendingCreationRef.current = undefined;
      }
      setEnableRequest((previous) =>
        previous &&
        previous.walletId === owner.walletId &&
        previous.indexedAccountId === owner.indexedAccountId &&
        previous.networkId === owner.networkId
          ? undefined
          : previous,
      );
    };
  }, [owner, setEnableRequest]);

  const applyPendingCreation = useCallback(() => {
    const pending = pendingCreationRef.current;
    if (!pending) return;
    const currentOwner = ownerRef.current;
    if (
      !currentOwner.mounted ||
      (currentOwner !== pending.owner &&
        initialOwnerRef.current !== pending.owner)
    ) {
      pendingCreationRef.current = undefined;
      return;
    }
    if (currentOwner === pending.owner && !currentOwner.indexedAccountId) {
      return;
    }
    pendingCreationRef.current = undefined;
    if (currentOwner.indexedAccountId !== pending.request.indexedAccountId) {
      return;
    }
    if (!pending.owner.indexedAccountId) {
      handoffEmptyMoneroPortfolioDraft({
        source: pending.emptyPortfolioDraft,
        walletId: pending.request.walletId,
        indexedAccountId: pending.request.indexedAccountId,
      });
    }
    setEnableRequest(pending.request);
  }, [setEnableRequest]);
  useLayoutEffect(() => {
    applyPendingCreation();
  }, [applyPendingCreation, owner]);

  const onCreateDone = useCallback<
    NonNullable<
      ComponentProps<
        typeof LazyAccountSelectorCreateAddressButton
      >['onCreateDone']
    >
  >(
    (result) => {
      const currentOwner = ownerRef.current;
      if (
        !enableAfterCreate ||
        !currentOwner.mounted ||
        (currentOwner !== owner && initialOwnerRef.current !== owner) ||
        !walletId ||
        !networkId ||
        result?.walletId !== walletId ||
        !result.indexedAccountId ||
        (currentOwner.indexedAccountId &&
          result.indexedAccountId !== currentOwner.indexedAccountId)
      ) {
        return;
      }
      const createdAccount = result.accounts.find(
        (account) =>
          account.impl === IMPL_XMR &&
          account.indexedAccountId === result.indexedAccountId,
      );
      if (!createdAccount) return;
      pendingCreationRef.current = {
        owner,
        emptyPortfolioDraft,
        request: {
          walletId,
          indexedAccountId: result.indexedAccountId,
          networkId,
          accountId: createdAccount.id,
        },
      };
      applyPendingCreation();
    },
    [
      applyPendingCreation,
      emptyPortfolioDraft,
      enableAfterCreate,
      networkId,
      owner,
      walletId,
    ],
  );

  return { enableAfterCreate, onCreateDone };
}
