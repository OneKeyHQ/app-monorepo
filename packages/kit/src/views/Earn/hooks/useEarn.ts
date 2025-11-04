import { useEarnAccounts } from './useEarnAccounts';
import { useEarnData } from './useEarnData';
import { usePortfolioInfo } from './usePortfolioInfo';

export const useEarn = () => {
  const { isFetchingAccounts, refreshEarnAccounts } = useEarnAccounts();
  const { portfolioInfo, isPortfolioLoading } = usePortfolioInfo();

  const { investments } = useEarnData();

  return {
    investments,
    isFetchingAccounts,
    refreshEarnAccounts,
    portfolioInfo,
    isPortfolioLoading,
  };
};
