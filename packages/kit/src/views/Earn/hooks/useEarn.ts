import { useEarnAccounts } from './useEarnAccounts';
import { usePortfolioInfo } from './usePortfolioInfo';

export const useEarn = () => {
  const { isFetchingAccounts, refreshEarnAccounts } = useEarnAccounts();
  const { portfolioInfo, isPortfolioLoading } = usePortfolioInfo();

  return {
    isFetchingAccounts,
    refreshEarnAccounts,
    portfolioInfo,
    isPortfolioLoading,
  };
};
