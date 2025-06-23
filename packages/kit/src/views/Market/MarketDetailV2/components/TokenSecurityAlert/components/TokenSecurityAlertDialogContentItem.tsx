import {
  Button,
  SizableText,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { TokenSecurityAlertDialogContentIcon } from './TokenSecurityAlertDialogContentIcon';

type ITokenSecurityAlertDialogContentItemProps = {
  item: {
    key: string;
    label: string;
    value?: string;
    isWarning: boolean;
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
        color={item.isWarning ? '$textCaution' : '$text'}
        flex={1}
      >
        {item.label}
      </SizableText>

      <XStack gap="$2" alignItems="center">
        {item.value ? (
          <Button variant="tertiary" size="small" onPress={handleCopyValue}>
            <SizableText
              size="$bodyMdMedium"
              color={item.isWarning ? '$textCaution' : '$textSuccess'}
              textAlign="right"
            >
              {formatValue(item.value)}
            </SizableText>
          </Button>
        ) : null}

        {typeof item.value === 'string' && item.value.length > 0 ? null : (
          <TokenSecurityAlertDialogContentIcon isWarning={item.isWarning} />
        )}
      </XStack>
    </XStack>
  );
}

export { TokenSecurityAlertDialogContentItem };
