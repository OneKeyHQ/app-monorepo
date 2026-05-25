import { useCallback, useMemo } from 'react';

import {
  Badge,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';

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

// TODO: replace with real data once backend ships
export const MOCK_KYT_RESULT: IKytCheckResult = {
  level: EKytRiskLevel.Low,
  assetsChecked: 1,
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

export function TxKYTRiskCheck({
  kytResult,
  onPress,
}: {
  kytResult?: IKytCheckResult;
  onPress?: () => void;
}) {
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

  const handlePress = useCallback(() => {
    if (config?.drillIn && onPress) {
      onPress();
    }
  }, [config?.drillIn, onPress]);

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
