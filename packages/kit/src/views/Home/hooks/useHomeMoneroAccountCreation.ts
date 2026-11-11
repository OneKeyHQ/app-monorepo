import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';

import type { LazyAccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/LazyAccountSelectorCreateAddressButton';
import { useHomeMoneroEnableRequestAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { IMPL_XMR } from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

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
  const ownerRef = useRef(owner);
  const initialOwnerRef = useRef<typeof owner | undefined>(undefined);
  if (ownerRef.current !== owner) {
    const previous = ownerRef.current;
    // First creation selects its new index before onCreateDone. Allow only
    // that one transition; any further selection invalidates the handoff.
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
        result.indexedAccountId !== currentOwner.indexedAccountId
      ) {
        return;
      }
      const createdAccount = result.accounts.find(
        (account) =>
          account.impl === IMPL_XMR &&
          account.indexedAccountId === result.indexedAccountId,
      );
      if (!createdAccount) return;
      setEnableRequest({
        walletId,
        indexedAccountId: result.indexedAccountId,
        networkId,
        accountId: createdAccount.id,
      });
    },
    [enableAfterCreate, networkId, owner, setEnableRequest, walletId],
  );

  return { enableAfterCreate, onCreateDone };
}
