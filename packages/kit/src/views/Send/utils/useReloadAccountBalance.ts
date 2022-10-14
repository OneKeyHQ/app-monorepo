import { useManageTokensOfAccount } from '../../../hooks';

export function useReloadAccountBalance({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  // do not remove this line, call account balance fetch
  useManageTokensOfAccount({
    fetchTokensOnMount: true,
    accountId,
    networkId,
  });
}
