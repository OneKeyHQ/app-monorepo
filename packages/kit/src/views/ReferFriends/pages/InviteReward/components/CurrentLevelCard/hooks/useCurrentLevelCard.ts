import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }), // Auto refresh every 1 minute
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
    // Convert to array format for easier iteration in components
    let commissionRates: Array<{
      subject: string;
      rate: {
        you: number;
        invitee: number;
        label: string;
      };
    }> = [];

    // Use more detailed commission rates if available
    if (detailLevel?.commissionRates) {
      const rates = detailLevel.commissionRates;

      // Convert rates to array format (similar to LevelAccordionItem)
      if (Array.isArray(rates)) {
        commissionRates = rates.map((rate, index) => ({
          subject: rate.labelKey ?? `${index}`,
          rate: {
            you: rate.rebate,
            invitee: rate.discount,
            label:
              rate.commissionRatesLabel || rate.label || `Rate ${index + 1}`,
          },
        }));
      } else {
        // Handle Record<string, IInviteLevelCommissionRate> format
        commissionRates = Object.entries(rates).map(([subject, rate]) => ({
          subject,
          rate: {
            you: rate.rebate,
            invitee: rate.discount,
            label: rate.commissionRatesLabel || rate.label || subject,
          },
        }));
      }
    } else {
      // Fallback to default values if no detailed data available
      commissionRates = [
        {
          subject: 'HardwareSales',
          rate: {
            you: currentLevel.rebate || 5,
            invitee: currentLevel.discount || 5,
            label: 'Hardware sales',
          },
        },
        {
          subject: 'Onchain',
          rate: {
            you: currentLevel.rebate || 10,
            invitee: currentLevel.discount || 10,
            label: 'DeFi performance fee',
          },
        },
      ];
    }

    return {
      currentLevel,
      levelIcon,
      levelLabel,
      commissionRates,
    };
  }, [rebateConfig, rebateLevels, levelDetail]);
}
