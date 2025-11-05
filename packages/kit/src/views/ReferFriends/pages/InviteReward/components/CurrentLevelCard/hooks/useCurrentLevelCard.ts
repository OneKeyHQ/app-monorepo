import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type {
  ICurrentLevelCardProps,
  IUseCurrentLevelCardReturn,
} from '../types';

export function useCurrentLevelCard(
  props: ICurrentLevelCardProps,
): IUseCurrentLevelCardReturn {
  const { rebateConfig, rebateLevels } = props;

  // Fetch level detail to get more accurate data
  const { result: levelDetail } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      initResult: undefined,
    },
  );

  return useMemo(() => {
    // Get current level info
    const currentLevel = rebateConfig;

    // Find the basic level info from rebateLevels
    const basicLevelInfo = rebateLevels?.find(
      (level) => level.level === currentLevel.level,
    );

    // Use levelDetail for complete data if available
    let detailLevel;
    if (levelDetail?.levels) {
      detailLevel = levelDetail.levels.find((level) => level.isCurrent);
    }

    // Get level icon URL and label from API data
    const levelIcon = detailLevel?.icon || '';
    const levelLabel =
      detailLevel?.label || basicLevelInfo?.label || currentLevel.label || '';

    // Get commission rates from detailed level data if available
    let commissionRates = {
      hardwareSales: {
        you: currentLevel.rebate || 5,
        invitee: currentLevel.discount || 5,
        label: 'Hardware sales',
      },
      defi: {
        you: currentLevel.rebate || 10,
        invitee: currentLevel.discount || 10,
        label: 'DeFi performance fee',
      },
    };

    // Use more detailed commission rates if available
    if (detailLevel?.commissionRates) {
      const rates = detailLevel.commissionRates;

      // Check if rates is an object with HardwareSales and Onchain properties
      if ('HardwareSales' in rates && 'Onchain' in rates) {
        commissionRates = {
          hardwareSales: {
            you: rates.HardwareSales.rebate,
            invitee: rates.HardwareSales.discount,
            label:
              rates.HardwareSales.commissionRatesLabel ||
              rates.HardwareSales.label ||
              'Hardware sales',
          },
          defi: {
            you: rates.Onchain.rebate,
            invitee: rates.Onchain.discount,
            label:
              rates.Onchain.commissionRatesLabel ||
              rates.Onchain.label ||
              'DeFi performance fee',
          },
        };
      }
    }

    return {
      currentLevel,
      levelIcon,
      levelLabel,
      commissionRates,
    };
  }, [rebateConfig, rebateLevels, levelDetail]);
}
