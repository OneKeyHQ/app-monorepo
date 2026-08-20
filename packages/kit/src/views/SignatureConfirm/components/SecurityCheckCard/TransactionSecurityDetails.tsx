import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { sortTransactionSecurityFeatures } from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityFeature,
} from '@onekeyhq/shared/types/transactionSecurity';

import { SignatureConfirmTestIDs } from '../../testIDs';

function getLevelStyle(level: EHostSecurityLevel): {
  icon: IKeyOfIcons;
  iconColor: IIconProps['color'];
} {
  if (level === EHostSecurityLevel.High) {
    return {
      icon: 'ErrorSolid',
      iconColor: '$iconCritical',
    };
  }
  if (level === EHostSecurityLevel.Medium) {
    return {
      icon: 'InfoSquareSolid',
      iconColor: '$iconCaution',
    };
  }
  if (level === EHostSecurityLevel.Security) {
    return {
      icon: 'BadgeVerifiedSolid',
      iconColor: '$iconSuccess',
    };
  }
  return {
    icon: 'InfoCircleOutline',
    iconColor: '$iconInfo',
  };
}

function FeatureRow({ feature }: { feature: ITransactionSecurityFeature }) {
  const title = feature.title?.trim() || feature.address;
  if (!title) {
    return null;
  }
  const style = getLevelStyle(feature.level);
  return (
    <XStack gap="$2.5" alignItems="flex-start">
      <YStack
        w="$5"
        h="$5"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon name={style.icon} size="$5" color={style.iconColor} />
      </YStack>
      <YStack gap="$1" flex={1} minWidth={0}>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        {feature.content ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {feature.content}
          </SizableText>
        ) : null}
        {feature.address && feature.title ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {feature.address}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

function TransactionSecurityDetails({
  result,
}: {
  result: ITransactionSecurityCheckResult;
}) {
  const style = getLevelStyle(result.level);
  const features = sortTransactionSecurityFeatures(result.detail.features);
  return (
    <YStack
      testID={SignatureConfirmTestIDs.TransactionSecurityDetails}
      gap="$4"
    >
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          w="$8"
          h="$8"
          borderRadius="$full"
          borderWidth={1}
          borderColor="$caution7"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon name={style.icon} size="$5" color={style.iconColor} />
        </YStack>
        <YStack gap="$1" flex={1} minWidth={0}>
          {result.detail.title ? (
            <SizableText size="$headingMd">{result.detail.title}</SizableText>
          ) : null}
          {result.detail.content ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {result.detail.content}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      {features.length ? (
        <YStack
          gap="$3"
          p="$3"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          {features.map((feature) => (
            <FeatureRow
              key={`${feature.code}-${feature.address ?? ''}`}
              feature={feature}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

export function showTransactionSecurityDetails({
  result,
  title,
}: {
  result: ITransactionSecurityCheckResult;
  title: string;
}) {
  Dialog.show({
    title,
    showFooter: false,
    renderContent: <TransactionSecurityDetails result={result} />,
  });
}
