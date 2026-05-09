import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export async function isAccountIdDeactivatedBotWallet({
  accountId,
}: {
  accountId?: string;
}): Promise<boolean> {
  if (!accountId) {
    return false;
  }
  const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
  if (!accountUtils.isBotWallet({ walletId })) {
    return false;
  }
  return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
    walletId,
  });
}

// Resolve every owner accountId for an address, including BTC fresh-address
// owners. BTC fresh addresses are not in the regular address index, so the
// caller must fall back to serviceFreshAddress.getAccountNameFromFreshAddress
// or the deactivation check would miss them.
export async function resolveAddressOwnerAccountIds({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}): Promise<string[]> {
  if (!networkId || !address) {
    return [];
  }
  let walletAccountItems: { accountId: string }[] = [];
  try {
    walletAccountItems =
      await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
        networkId,
        address,
      });
  } catch {
    walletAccountItems = [];
  }
  if (walletAccountItems.length === 0 && networkUtils.isBTCNetwork(networkId)) {
    try {
      walletAccountItems =
        await backgroundApiProxy.serviceFreshAddress.getAccountNameFromFreshAddress(
          {
            address,
            networkId,
          },
        );
    } catch {
      walletAccountItems = [];
    }
  }
  return walletAccountItems
    .map((item) => item.accountId)
    .filter((accountId): accountId is string => Boolean(accountId));
}

export async function isAddressOwnedByDeactivatedBotWallet({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}): Promise<boolean> {
  const ownerAccountIds = await resolveAddressOwnerAccountIds({
    networkId,
    address,
  });
  for (const accountId of ownerAccountIds) {
    // eslint-disable-next-line no-await-in-loop
    const isDeactivated = await isAccountIdDeactivatedBotWallet({
      accountId,
    });
    if (isDeactivated) {
      return true;
    }
  }
  return false;
}
