import { useCallback, useMemo } from 'react';

import {
  Badge,
  Dialog,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';

export enum EKytRiskLevel {
  Checking = 'checking',
  None = 'none',
  Low = 'low',
  Moderate = 'moderate',
  High = 'high',
  Severe = 'severe',
  Failed = 'failed',
}

export type IKytAssetResult = {
  symbol: string;
  tokenName: string;
  tokenImageUri?: string;
  level: EKytRiskLevel;
};

export type IKytCheckResult = {
  level: EKytRiskLevel;
  assetsChecked?: number;
  assets?: IKytAssetResult[];
};

const RISK_LEVEL_CONFIG: Record<
  EKytRiskLevel,
  {
    badgeType: IBadgeType;
    label: string;
    subtitle: string;
    drillIn: boolean;
  }
> = {
  [EKytRiskLevel.Checking]: {
    badgeType: 'default',
    label: 'Checking',
    subtitle: 'Checking fund-source risk',
    drillIn: false,
  },
  [EKytRiskLevel.None]: {
    badgeType: 'default',
    label: '',
    subtitle: 'No significant risk detected',
    drillIn: false,
  },
  [EKytRiskLevel.Low]: {
    badgeType: 'success',
    label: 'Low',
    subtitle: 'Low fund-source risk',
    drillIn: true,
  },
  [EKytRiskLevel.Moderate]: {
    badgeType: 'warning',
    label: 'Moderate',
    subtitle: 'Moderate fund-source risk',
    drillIn: true,
  },
  [EKytRiskLevel.High]: {
    badgeType: 'critical',
    label: 'High',
    subtitle: 'High fund-source risk',
    drillIn: true,
  },
  [EKytRiskLevel.Severe]: {
    badgeType: 'critical',
    label: 'Severe',
    subtitle: 'Severe fund-source risk',
    drillIn: true,
  },
  [EKytRiskLevel.Failed]: {
    badgeType: 'default',
    label: 'Failed',
    subtitle: 'Unable to check fund-source risk',
    drillIn: false,
  },
};

const USDT_IMAGE =
  'https://uni.onekey-asset.com/server-service-onekey/coin-images/Tether-USD-USDT.png';
const USDC_IMAGE =
  'https://uni.onekey-asset.com/server-service-onekey/coin-images/USD-Coin-USDC.png';

export const MOCK_KYT_RESULT: IKytCheckResult = {
  level: EKytRiskLevel.High,
  assetsChecked: 2,
  assets: [
    {
      symbol: 'USDC',
      tokenName: 'USD Coin',
      tokenImageUri: USDC_IMAGE,
      level: EKytRiskLevel.Low,
    },
    {
      symbol: 'USDT',
      tokenName: 'Tether USD',
      tokenImageUri: USDT_IMAGE,
      level: EKytRiskLevel.High,
    },
  ],
};

function KytBadge({ level }: { level: EKytRiskLevel }) {
  const config = RISK_LEVEL_CONFIG[level];

  if (level === EKytRiskLevel.None) {
    return null;
  }

  if (level === EKytRiskLevel.Failed) {
    return (
      <Badge badgeType="default" badgeSize="sm">
        <XStack ai="center" gap="$1">
          <Icon name="InfoCircleOutline" size="$3.5" color="$iconSubdued" />
          <Badge.Text>Failed</Badge.Text>
        </XStack>
      </Badge>
    );
  }

  return (
    <Badge badgeType={config.badgeType} badgeSize="sm">
      {config.label}
    </Badge>
  );
}

function KytAssetSelectionDialogContent({
  assets,
  onSelectAsset,
}: {
  assets: IKytAssetResult[];
  onSelectAsset: (asset: IKytAssetResult) => void;
}) {
  return (
    <YStack mx="$-5">
      {assets.map((asset) => (
        <ListItem
          key={asset.symbol}
          title={asset.symbol}
          subtitle={asset.tokenName}
          drillIn
          onPress={() => onSelectAsset(asset)}
          renderAvatar={<Token size="lg" tokenImageUri={asset.tokenImageUri} />}
        />
      ))}
    </YStack>
  );
}

export function TxKYTRiskCheck({ kytResult }: { kytResult?: IKytCheckResult }) {
  const navigation = useAppNavigation();

  const config = useMemo(() => {
    if (!kytResult) return null;
    return RISK_LEVEL_CONFIG[kytResult.level];
  }, [kytResult]);

  const subtitle = useMemo(() => {
    if (!kytResult) return '';
    if ((kytResult.assetsChecked ?? 0) > 1) {
      return `${kytResult.assetsChecked} assets checked`;
    }
    return RISK_LEVEL_CONFIG[kytResult.level].subtitle;
  }, [kytResult]);

  const navigateToDetail = useCallback(
    (asset: IKytAssetResult) => {
      navigation.push(EModalAssetDetailRoutes.KytRiskDetail, {
        symbol: asset.symbol,
        tokenName: asset.tokenName,
      });
    },
    [navigation],
  );

  const handlePress = useCallback(() => {
    if (!kytResult) return;

    const assets = kytResult.assets ?? [];
    if (assets.length > 1) {
      const dialogInstance = Dialog.show({
        title: 'Fund-source risk check',
        description: `${kytResult.assetsChecked} assets checked`,
        showFooter: false,
        renderContent: (
          <KytAssetSelectionDialogContent
            assets={assets}
            onSelectAsset={(asset) => {
              void dialogInstance.close();
              navigateToDetail(asset);
            }}
          />
        ),
      });
      return;
    }

    if (assets.length === 1) {
      navigateToDetail(assets[0]);
    }
  }, [kytResult, navigateToDetail]);

  if (!kytResult || !config) {
    return null;
  }

  const showDrillIn = config.drillIn || (kytResult.assetsChecked ?? 0) > 1;

  return (
    <>
      <Divider mx="$5" />
      <XStack
        px="$3"
        py="$2.5"
        ai="center"
        gap="$3"
        borderRadius="$3"
        mx="$2"
        my="$1"
        {...(showDrillIn && {
          onPress: handlePress,
          cursor: 'pointer',
          hoverStyle: { bg: '$bgHover' },
          pressStyle: { bg: '$bgActive' },
        })}
      >
        <Stack flex={1} gap="$1">
          <SizableText size="$bodyMdMedium">Fund-source risk check</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {subtitle}
          </SizableText>
        </Stack>
        <XStack ai="center" gap="$2">
          <KytBadge level={kytResult.level} />
          {showDrillIn ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      </XStack>
    </>
  );
}
