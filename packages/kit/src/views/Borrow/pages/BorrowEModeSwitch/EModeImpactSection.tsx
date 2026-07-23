import { useIntl } from 'react-intl';

import {
  Alert,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { BorrowInfoItem } from '@onekeyhq/kit/src/views/Borrow/components/BorrowInfoItem';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBorrowEModeSwitchCheck,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { shouldShowCurrentHealthFactorSkeleton } from './emodeUtils';

type IImpactData = {
  current?: { title?: IEarnText };
  latest?: { title?: IEarnText };
};

function maskUntrustedProjection(data?: IImpactData): IImpactData {
  if (!data) {
    return {};
  }

  return {
    current: data.current,
    latest: data.latest
      ? {
          title: {
            text: '—',
          },
        }
      : undefined,
  };
}

function ImpactValue({
  label,
  data,
  showLiquidationHint,
}: {
  label: string;
  data: IImpactData;
  showLiquidationHint?: boolean;
}) {
  const intl = useIntl();

  return (
    <BorrowInfoItem title={label} variant="highlight">
      <YStack ai="flex-end">
        <XStack ai="center" gap="$3">
          <EarnText
            text={data.current?.title}
            size="$headingMd"
            opacity={data.latest ? 0.5 : 1}
          />
          {data.latest ? (
            <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
          ) : null}
          {data.latest ? (
            <EarnText text={data.latest.title} size="$headingMd" />
          ) : null}
        </XStack>
        {showLiquidationHint ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.defi_liquidation_at_less_than_1_00,
            })}
          </SizableText>
        ) : null}
      </YStack>
    </BorrowInfoItem>
  );
}

export function EModeImpactSection({
  isCurrent,
  check,
  isChecking,
  currentMaxLtv,
  currentHealthFactor,
  currentHealthFactorLoading,
}: {
  isCurrent: boolean;
  check: IBorrowEModeSwitchCheck | null;
  isChecking: boolean;
  currentMaxLtv?: string;
  currentHealthFactor?: IEarnText;
  currentHealthFactorLoading: boolean;
}) {
  const intl = useIntl();

  if (isChecking) {
    return (
      <YStack gap="$3">
        <Skeleton h="$8" />
        <Skeleton h="$8" />
      </YStack>
    );
  }
  if (!isCurrent && !check) {
    return null;
  }

  // The switch-check response does not expose enough reserve-level inputs to
  // verify its account projection, so keep the current value and mask latest.
  const targetMaxLtv = maskUntrustedProjection(check?.maxLtv);
  const maxLtv: IImpactData = isCurrent
    ? {
        current: {
          title: { text: currentMaxLtv ? `${currentMaxLtv}%` : '—' },
        },
      }
    : targetMaxLtv;
  const healthFactor: IImpactData = isCurrent
    ? { current: { title: currentHealthFactor ?? { text: '—' } } }
    : maskUntrustedProjection(check?.healthFactor);
  const atRisk = check?.healthFactor?.latest?.title?.color === '$textCritical';

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">
        {intl.formatMessage({
          id: ETranslations.defi_emode_position_impact,
        })}
      </SizableText>
      <YStack
        p="$3.5"
        gap="$5"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <ImpactValue
          label={intl.formatMessage({ id: ETranslations.defi_max_ltv })}
          data={maxLtv}
        />
        {shouldShowCurrentHealthFactorSkeleton({
          isCurrent,
          currentHealthFactorLoading,
          currentHealthFactor,
        }) ? (
          <Skeleton h="$8" />
        ) : (
          <ImpactValue
            label={intl.formatMessage({
              id: ETranslations.defi_health_factor,
            })}
            data={healthFactor}
            showLiquidationHint
          />
        )}
      </YStack>
      {atRisk ? (
        <Alert
          type="critical"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.defi_emode_risk_near_liquidation,
          })}
        />
      ) : null}
    </YStack>
  );
}
