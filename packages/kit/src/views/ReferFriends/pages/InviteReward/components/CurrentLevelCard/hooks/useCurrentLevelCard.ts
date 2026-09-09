import { useMemo } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type {
  ICurrentLevelCardProps,
  IUseCurrentLevelCardReturn,
} from '../types';

function getDisplayLabel(
  intl: IntlShape,
  labelKey?: string,
  fallback?: string,
): string {
  if (labelKey) {
    return intl.formatMessage({
      id: labelKey as ETranslations,
      defaultMessage: fallback,
    });
  }
  return fallback ?? '';
}

export function useCurrentLevelCard(
  props: ICurrentLevelCardProps,
): IUseCurrentLevelCardReturn {
  const { rebateConfig, rebateLevels } = props;
  const intl = useIntl();

  const { result: levelDetail } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      initResult: undefined,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return useMemo(() => {
    const currentLevel = rebateConfig;
    const targetLevel = levelDetail?.currentLevel ?? currentLevel.level;

    const detailLevel =
      levelDetail?.levels.find((level) => level.level === targetLevel) ??
      levelDetail?.levels.find((level) => level.isCurrent);
    const displayedLevel = detailLevel?.level ?? targetLevel;
    const basicLevelInfo = rebateLevels?.find(
      (level) => level.level === displayedLevel,
    );

    const levelIcon =
      detailLevel?.icon || basicLevelInfo?.icon || currentLevel.icon || '';
    const levelLabel = getDisplayLabel(
      intl,
      detailLevel?.labelKey ??
        basicLevelInfo?.labelKey ??
        currentLevel.labelKey,
      detailLevel?.label ?? basicLevelInfo?.label ?? currentLevel.label,
    );

    let commissionRates: Array<{
      subject: string;
      rate: {
        you: number;
        invitee: number;
        label: string;
      };
    }> = [];

    const rates =
      detailLevel?.commissionRates ??
      basicLevelInfo?.configs ??
      (displayedLevel === currentLevel.level
        ? currentLevel.configs
        : undefined);

    if (rates) {
      if (Array.isArray(rates)) {
        commissionRates = rates.map((rate, index) => ({
          subject: rate.labelKey ?? rate.commissionRatesLabelKey ?? `${index}`,
          rate: {
            you: rate.rebate,
            invitee: rate.discount,
            label: getDisplayLabel(
              intl,
              rate.commissionRatesLabelKey ?? rate.labelKey,
              rate.commissionRatesLabel ?? rate.label,
            ),
          },
        }));
      } else {
        commissionRates = Object.entries(rates).map(([subject, rate]) => ({
          subject,
          rate: {
            you: rate.rebate,
            invitee: rate.discount,
            label: getDisplayLabel(
              intl,
              rate.commissionRatesLabelKey ?? rate.labelKey,
              rate.commissionRatesLabel ?? rate.label ?? subject,
            ),
          },
        }));
      }

      commissionRates = sortCommissionRateItems(commissionRates);
    }

    return {
      currentLevel,
      levelIcon,
      levelLabel,
      commissionRates,
    };
  }, [intl, levelDetail, rebateConfig, rebateLevels]);
}
