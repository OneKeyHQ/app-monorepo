import { useActiveWalletAccount } from './redux';
import { useAccountTokenLoading, useAccountTokens } from './useTokens';

export const useManageTokensOfAccount = ({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) => {
  const accountTokens = useAccountTokens(networkId, accountId);
  const accountTokensLoading = useAccountTokenLoading(networkId, accountId);

  return {
    loading: accountTokensLoading,
    accountTokens,
  };
};

export const useManageTokens = () => {
  const { accountId, networkId } = useActiveWalletAccount();
  return useManageTokensOfAccount({
    accountId,
    networkId,
  });
};
