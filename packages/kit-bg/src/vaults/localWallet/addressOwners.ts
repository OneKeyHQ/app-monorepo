import type { ILocalWalletCapability } from './types';

export async function findLocalWalletAddressOwners({
  capability,
  address,
}: {
  capability: Pick<
    ILocalWalletCapability,
    | 'listAccounts'
    | 'getAccountState'
    | 'getAccountAddresses'
    | 'isSameRecipient'
  >;
  address: string;
}): Promise<string[]> {
  const { accounts } = await capability.listAccounts();
  const matches = await Promise.allSettled(
    accounts.map(async ({ accountId }) => {
      const state = await capability.getAccountState({ accountId });
      if (!state.enabled) return undefined;
      const addresses = await capability.getAccountAddresses({ accountId });
      const { privateAddress } = addresses ?? {};
      const isPrivateMatch =
        !!privateAddress &&
        (capability.isSameRecipient?.(privateAddress, address) ??
          privateAddress === address);
      return isPrivateMatch || addresses?.publicAddress === address
        ? accountId
        : undefined;
    }),
  );
  return [
    ...new Set(
      matches.flatMap((match) =>
        match.status === 'fulfilled' && match.value !== undefined
          ? [match.value]
          : [],
      ),
    ),
  ];
}
