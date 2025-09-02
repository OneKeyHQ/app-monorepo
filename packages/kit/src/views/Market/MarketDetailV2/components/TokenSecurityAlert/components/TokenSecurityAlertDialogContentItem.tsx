import {
  Icon,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { NATIVE_HIT_SLOP } from '@onekeyhq/components/src/utils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { TokenSecurityAlertDialogContentIcon } from './TokenSecurityAlertDialogContentIcon';

// Helper function to get text color based on risk type
const getTextColorByRiskType = (
  riskType: 'safe' | 'caution' | 'normal' | 'risk',
) => {
  switch (riskType) {
    case 'safe':
      return '$textSuccess';
    case 'caution':
      return '$textCaution';
    case 'risk':
      return '$textCritical';
    case 'normal':
    default:
      return '$text';
  }
};

type ITokenSecurityAlertDialogContentItemProps = {
  item: {
    key: string;
    label: string;
    value?: string | number | boolean;
    riskType: 'safe' | 'caution' | 'normal' | 'risk';
  };
};

function TokenSecurityAlertDialogContentItem({
  item,
}: ITokenSecurityAlertDialogContentItemProps) {
  const { copyText } = useClipboard();

  const isLongString = (value: string | number | boolean | undefined) => {
    return typeof value === 'string' && value.length > 20;
  };

  const formatValue = (value: string | number | boolean) => {
    if (isLongString(value)) {
      return accountUtils.shortenAddress({
        address: value as string,
        leadingLength: 8,
        trailingLength: 6,
      });
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return value;
  };

  const handleCopyValue = () => {
    if (item.value) {
      copyText(String(item.value));
    }
  };

  return (
    <XStack
      key={item.key}
      justifyContent="space-between"
      alignItems="center"
      py="$2"
    >
      <SizableText size="$bodyMdMedium" color="$text" flex={1}>
        {item.label}
      </SizableText>

      <XStack gap="$1.5" alignItems="center">
        {(() => {
          // Don't show icon if there's a value or if risk type is normal
          if (item.riskType === 'normal') {
            return null;
          }
          return (
            <TokenSecurityAlertDialogContentIcon riskType={item.riskType} />
          );
        })()}

        <SizableText
          size="$bodyMdMedium"
          color={getTextColorByRiskType(item.riskType)}
          textAlign="right"
        >
          {formatValue(item.value ?? '')}
        </SizableText>

        {isLongString(item.value) ? (
          <Stack
            w="$4"
            h="$4"
            cursor="pointer"
            onPress={handleCopyValue}
            hitSlop={NATIVE_HIT_SLOP}
            group
          >
            <Icon
              name="Copy3Outline"
              size="$4"
              color="$iconSubdued"
              $group-hover={{ color: '$iconHover' }}
            />
          </Stack>
        ) : null}
      </XStack>
    </XStack>
  );
}

export { TokenSecurityAlertDialogContentItem };
