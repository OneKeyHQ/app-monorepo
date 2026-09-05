import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { sortTransactionSecurityFeatures } from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityFeature,
} from '@onekeyhq/shared/types/transactionSecurity';

import { normalizeSecurityFindingTitle } from './utils';

function getLevelStyle(level: EHostSecurityLevel): {
  icon: IKeyOfIcons;
  iconColor: IIconProps['color'];
} {
  if (level === EHostSecurityLevel.High) {
    return {
      icon: 'ErrorOutline',
      iconColor: '$iconCritical',
    };
  }
  if (level === EHostSecurityLevel.Medium) {
    return {
      icon: 'InfoSquareOutline',
      iconColor: '$iconCaution',
    };
  }
  if (level === EHostSecurityLevel.Security) {
    return {
      icon: 'CheckRadioOutline',
      iconColor: '$iconSuccess',
    };
  }
  return {
    icon: 'QuestionmarkOutline',
    iconColor: '$iconSubdued',
  };
}

function FeatureRow({ feature }: { feature: ITransactionSecurityFeature }) {
  const rawTitle = feature.title?.trim() || feature.address;
  if (!rawTitle) {
    return null;
  }
  const title = normalizeSecurityFindingTitle(rawTitle);
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

export function TransactionSecurityFeatureList({
  result,
}: {
  result: ITransactionSecurityCheckResult;
}) {
  const features = sortTransactionSecurityFeatures(result.detail.features);
  if (!features.length) {
    return null;
  }
  return (
    <YStack gap="$3.5">
      {features.map((feature, index) => (
        <FeatureRow
          key={`${feature.code}-${feature.address ?? ''}-${index}`}
          feature={feature}
        />
      ))}
    </YStack>
  );
}
