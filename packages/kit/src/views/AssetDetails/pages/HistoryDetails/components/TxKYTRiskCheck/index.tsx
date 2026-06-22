import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  resolveKytDisplayLevel,
  resolveKytItemLevel,
} from '@onekeyhq/shared/src/utils/kytUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import type {
  IKytHistoryResult,
  IKytRiskDetail,
} from '@onekeyhq/shared/types/kyt';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import { InfoItem, InfoItemGroup } from '../TxDetailsInfoItem';

const RISK_LEVEL_CONFIG: Record<
  EKytRiskLevel,
  {
    badgeType: IBadgeType;
    label?: ETranslations;
    subtitle: ETranslations;
    drillIn: boolean;
  }
> = {
  [EKytRiskLevel.Checking]: {
    badgeType: 'info',
    label: ETranslations.kyt_risk_level_checking__title,
    subtitle: ETranslations.kyt_risk_level_checking__desc,
    drillIn: false,
  },
  [EKytRiskLevel.None]: {
    badgeType: 'default',
    subtitle: ETranslations.kyt_risk_level_none__desc,
    drillIn: false,
  },
  [EKytRiskLevel.Low]: {
    badgeType: 'success',
    label: ETranslations.kyt_risk_level_low__title,
    subtitle: ETranslations.kyt_risk_level_low__desc,
    drillIn: true,
  },
  [EKytRiskLevel.Moderate]: {
    badgeType: 'warning',
    label: ETranslations.kyt_risk_level_moderate__title,
    subtitle: ETranslations.kyt_risk_level_moderate__desc,
    drillIn: true,
  },
  [EKytRiskLevel.High]: {
    badgeType: 'warning',
    label: ETranslations.kyt_risk_level_high__title,
    subtitle: ETranslations.kyt_risk_level_high__desc,
    drillIn: true,
  },
  [EKytRiskLevel.Severe]: {
    badgeType: 'critical',
    label: ETranslations.kyt_risk_level_severe__title,
    subtitle: ETranslations.kyt_risk_level_severe__desc,
    drillIn: true,
  },
  [EKytRiskLevel.Failed]: {
    badgeType: 'default',
    label: ETranslations.global_failed,
    subtitle: ETranslations.kyt_risk_level_failed__desc,
    drillIn: false,
  },
};

// Map the server KYT block into the per-asset detail view models the UI renders.
// Token name/logo/amount are resolved from the decoded receives (matched by
// token address), which are available from the list before the detail request.
function buildRiskDetails({
  kyt,
  transfers,
  networkName,
}: {
  kyt: IKytHistoryResult;
  transfers?: IDecodedTxTransferInfo[];
  networkName?: string;
}): IKytRiskDetail[] {
  return kyt.list.map((item) => {
    const transfer = transfers?.find(
      (t) => t.tokenIdOnNetwork === item.tokenAddress,
    );
    const symbol = item.asset.tokenSymbol || transfer?.symbol || '';
    const amount = transfer?.amount
      ? new BigNumber(transfer.amount).toFixed()
      : undefined;
    return {
      level: resolveKytItemLevel(item.status, item.level),
      checkedAt: item.checkedAt
        ? formatDate(new Date(item.checkedAt * 1000))
        : '',
      asset: {
        symbol,
        tokenName: transfer?.name,
        tokenImageUri: transfer?.icon,
        networkName: networkName ?? '',
      },
      transferAmount: amount ? `+${amount} ${symbol}` : '',
      factors: item.reasons ?? [],
      reportUrl: item.reportUrl,
    };
  });
}

function KytBadge({ level }: { level: EKytRiskLevel }) {
  const intl = useIntl();
  const config = RISK_LEVEL_CONFIG[level];

  if (level === EKytRiskLevel.None) {
    return null;
  }

  if (level === EKytRiskLevel.Failed) {
    return (
      <Badge badgeType="default" badgeSize="sm">
        <XStack ai="center" gap="$1">
          <Icon name="InfoCircleOutline" size="$3.5" color="$iconSubdued" />
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.global_failed })}
          </Badge.Text>
        </XStack>
      </Badge>
    );
  }

  return (
    <Badge badgeType={config.badgeType} badgeSize="sm">
      {config.label ? intl.formatMessage({ id: config.label }) : null}
    </Badge>
  );
}

function KytAssetSelectionDialogContent({
  details,
  onSelectAsset,
}: {
  details: IKytRiskDetail[];
  onSelectAsset: (detail: IKytRiskDetail) => void;
}) {
  return (
    <YStack mx="$-5">
      {details.map((detail, index) => (
        <ListItem
          key={`${detail.asset.symbol}-${index}`}
          title={detail.asset.symbol}
          subtitle={detail.asset.tokenName}
          drillIn
          onPress={() => onSelectAsset(detail)}
          renderAvatar={
            <Token size="lg" tokenImageUri={detail.asset.tokenImageUri} />
          }
        />
      ))}
    </YStack>
  );
}

export function TxKYTRiskCheck({
  kyt,
  transfers,
  networkName,
}: {
  kyt?: IKytHistoryResult;
  transfers?: IDecodedTxTransferInfo[];
  networkName?: string;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const details = useMemo(() => {
    if (!kyt?.list?.length) return [];
    return buildRiskDetails({ kyt, transfers, networkName });
  }, [kyt, transfers, networkName]);

  const level = resolveKytDisplayLevel(kyt);
  const config = level ? RISK_LEVEL_CONFIG[level] : null;

  const subtitle = useMemo(() => {
    if (!level) return '';
    if (details.length > 1) {
      return intl.formatMessage(
        { id: ETranslations.kyt_assets_checked__msg },
        { count: details.length },
      );
    }
    return intl.formatMessage({ id: RISK_LEVEL_CONFIG[level].subtitle });
  }, [details.length, intl, level]);

  const navigateToDetail = useCallback(
    (riskDetail: IKytRiskDetail) => {
      navigation.push(EModalAssetDetailRoutes.KytRiskDetail, { riskDetail });
    },
    [navigation],
  );

  const handlePress = useCallback(() => {
    if (details.length > 1) {
      const dialogInstance = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.kyt_source_of_funds_risk_check__title,
        }),
        description: intl.formatMessage(
          { id: ETranslations.kyt_assets_checked__msg },
          { count: details.length },
        ),
        showFooter: false,
        renderContent: (
          <KytAssetSelectionDialogContent
            details={details}
            onSelectAsset={(detail) => {
              // Await the dialog close before navigating. Running close() and
              // navigation.push() concurrently is a known Fabric crash / leftover
              // dialog pattern, so the push must wait for the dialog to unmount.
              void (async () => {
                await dialogInstance.close();
                navigateToDetail(detail);
              })();
            }}
          />
        ),
      });
      return;
    }

    if (details.length === 1) {
      navigateToDetail(details[0]);
    }
  }, [details, intl, navigateToDetail]);

  if (!level || !config || details.length === 0) {
    return null;
  }

  const showDrillIn = config.drillIn || details.length > 1;

  return (
    <InfoItemGroup>
      <InfoItem
        label={intl.formatMessage({
          id: ETranslations.kyt_source_of_funds_risk_check__title,
        })}
        renderContent={
          <XStack ai="center" jc="space-between" gap="$3">
            <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
              {subtitle}
            </SizableText>
            <XStack ai="center" gap="$2">
              <KytBadge level={level} />
              {showDrillIn ? (
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              ) : null}
            </XStack>
          </XStack>
        }
        borderRadius="$3"
        {...(showDrillIn && {
          onPress: handlePress,
          hoverStyle: { bg: '$bgHover' },
          pressStyle: { bg: '$bgActive' },
        })}
      />
    </InfoItemGroup>
  );
}
