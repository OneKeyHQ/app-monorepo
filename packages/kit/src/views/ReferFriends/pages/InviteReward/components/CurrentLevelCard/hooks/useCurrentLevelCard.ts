import { useMemo, useRef } from 'react';

import { isEqual } from 'lodash';
import { type IntlShape, useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';
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

export function useInviteLevelDetail({ isActive }: { isActive: boolean }): {
  levelDetail: IInviteLevelDetail | undefined;
  refreshLevelDetail: () => Promise<void>;
} {
  // An unchanged poll returns the previous object, so the one-minute polling
  // does not re-render the invite page.
  const lastRef = useRef<IInviteLevelDetail | undefined>(undefined);
  const { result, run } = usePromiseResult(
    async () => {
      const detail =
        await backgroundApiProxy.serviceReferralCode.getLevelDetail();
      if (lastRef.current && isEqual(detail, lastRef.current)) {
        return lastRef.current;
      }
      lastRef.current = detail;
      return detail;
    },
    [],
    {
      initResult: undefined,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  return { levelDetail: result, refreshLevelDetail: run };
}

export function useCurrentLevelCardFromDetail(
  props: ICurrentLevelCardProps,
  levelDetail: IInviteLevelDetail | undefined,
): IUseCurrentLevelCardReturn {
  const { rebateConfig, rebateLevels } = props;
  const intl = useIntl();

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

    let commissionRates: IUseCurrentLevelCardReturn['commissionRates'] = [];

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
            enabled: rate.enabled === true,
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
            enabled: rate.enabled === true,
          },
        }));
      }

      commissionRates = sortCommissionRateItems(commissionRates);
    }

    return {
      levelLabel,
      levelIcon,
      commissionRates,
    };
  }, [intl, levelDetail, rebateConfig, rebateLevels]);
}
