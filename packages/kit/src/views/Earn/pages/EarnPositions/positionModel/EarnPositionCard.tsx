import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { EARN_POSITION_PENDING_COPY } from './earnPositionModel';

import type {
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';
import type { IEarnPositionManageTarget } from './earnPositionModel.types';

export type IEarnPositionCardHandlers = {
  /** opens the position's own Earn detail page (EarnNavigation.pushToEarnProtocolDetails) */
  onManage?: (target: IEarnPositionManageTarget) => void;
  /** runs the claim the detail page runs, with the position's claim payload */
  onClaim?: (position: IEarnPositionView) => void;
};

/** "Deposited | Balance" and the token rows under it (figma 30292-17826). */
function PositionSection({
  section,
  currencySymbol,
  priceUnavailableLabel,
}: {
  section: IEarnPositionSectionView;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$1" py="$2">
      <XStack ai="center" jc="space-between" pb="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          {section.title}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_balance })}
        </SizableText>
      </XStack>
      {section.assets.map((asset, index) => (
        <XStack
          key={`${section.key}-${asset.symbol}-${index}`}
          ai="center"
          gap="$3"
        >
          <XStack ai="center" gap="$2" flex={1} minWidth={0}>
            <Token size="md" tokenImageUri={asset.meta?.logoUrl} />
            <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
              {asset.symbol}
            </SizableText>
          </XStack>
          <YStack ai="flex-end" flexShrink={0}>
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
              size="$bodyLg"
              textAlign="right"
              numberOfLines={1}
            />
            <NumberSizeableTextWrapper
              hideValue
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
              textAlign="right"
              numberOfLines={1}
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * One position, the wallet DeFi Portfolio card in the Earn design (figma
 * 29180-108096 and 30292-17104): badge and name, the position value, an
 * optional line under the header (health factor / est. unlock time), one
 * block per section, and the single action this position has.
 */
function EarnPositionCardCmp({
  position,
  onManage,
  onClaim,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const { value, meta, action } = position;

  return (
    <YStack
      gap="$2"
      p="$3"
      borderRadius="$3"
      borderCurve="continuous"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bgApp"
      testID={`earn-position-card-${position.key}`}
    >
      <XStack ai="center" jc="space-between" gap="$6" minHeight={24}>
        <XStack ai="center" gap="$3" flex={1} minWidth={0}>
          <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
            {position.badgeLabel}
          </Badge>
          {position.name ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {position.name}
            </SizableText>
          ) : null}
        </XStack>
        <ProtocolValueCell
          value={value.value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          partialPriceUnavailableLabel={intl.formatMessage({
            id: ETranslations.wallet_partial_price_unavailable,
          })}
          isUnavailable={!value.hasAvailableValue}
          showPriceUnavailableTooltip={
            value.hasAvailableValue && value.hasUnavailableValue
          }
          size="$headingMd"
          textAlign="right"
          numberOfLines={1}
        />
      </XStack>

      {meta?.kind === 'healthFactor' ? (
        <DeFiPositionHealthFactorRow healthFactor={meta.healthFactor} />
      ) : null}
      {meta?.kind === 'unlockAt' ? (
        <XStack ai="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {`${EARN_POSITION_PENDING_COPY.estUnlockTime}:`}
          </SizableText>
          <SizableText size="$bodySm">
            {formatDate(new Date(meta.unlockAt), { hideTimeForever: true })}
          </SizableText>
        </XStack>
      ) : null}

      <YStack>
        {position.sections.map((section) => (
          <PositionSection
            key={section.key}
            section={section}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
          />
        ))}
      </YStack>

      {action?.kind === 'manage' ? (
        <Button
          testID={`earn-position-manage-${position.key}`}
          size="medium"
          variant="secondary"
          onPress={() => onManage?.(action.target)}
        >
          {intl.formatMessage({ id: ETranslations.global_manage })}
        </Button>
      ) : null}
      {action?.kind === 'claim' ? (
        <Button
          testID={`earn-position-claim-${position.key}`}
          size="medium"
          variant="primary"
          onPress={() => onClaim?.(position)}
        >
          {intl.formatMessage({ id: ETranslations.earn_claim })}
        </Button>
      ) : null}
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
