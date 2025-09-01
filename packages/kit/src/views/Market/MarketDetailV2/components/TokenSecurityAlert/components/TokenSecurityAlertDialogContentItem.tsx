import {
  Button,
  SizableText,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
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
    value?: string;
    isWarning: boolean;
    riskType: 'safe' | 'caution' | 'normal' | 'risk';
  };
};

function TokenSecurityAlertDialogContentItem({
  item,
}: ITokenSecurityAlertDialogContentItemProps) {
  const { copyText } = useClipboard();

  const formatValue = (value: string) => {
    if (value.length > 20) {
      return accountUtils.shortenAddress({
        address: value,
        leadingLength: 8,
        trailingLength: 6,
      });
    }
    return value;
  };

  const handleCopyValue = () => {
    if (item.value) {
      copyText(item.value);
    }
  };

  return (
    <XStack
      key={item.key}
      justifyContent="space-between"
      alignItems="center"
      py="$2"
    >
      <SizableText
        size="$bodyMdMedium"
        color={getTextColorByRiskType(item.riskType)}
        flex={1}
      >
        {item.label}
      </SizableText>

      <XStack gap="$2" alignItems="center">
        {item.value ? (
          <Button variant="tertiary" size="small" onPress={handleCopyValue}>
            <SizableText
              size="$bodyMdMedium"
              color={getTextColorByRiskType(item.riskType)}
              textAlign="right"
            >
              {formatValue(item.value)}
            </SizableText>
          </Button>
        ) : null}

        {typeof item.value === 'string' &&
        item.value.length > 0 ? null : item.riskType === 'normal' ? null : (
          <TokenSecurityAlertDialogContentIcon
            isWarning={item.isWarning}
            riskType={item.riskType}
          />
        )}
      </XStack>
    </XStack>
  );
}

export { TokenSecurityAlertDialogContentItem };
