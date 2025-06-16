import { SizableText, XStack } from '@onekeyhq/components';

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
  return (
    <XStack
      key={item.key}
      justifyContent="space-between"
      alignItems="center"
      p="$2"
      borderRadius="$1"
    >
      <SizableText
        size="$bodyMd"
        color={item.isWarning ? '$textCaution' : '$text'}
        flex={1}
      >
        {item.label}
      </SizableText>

      <XStack gap="$2" alignItems="center">
        {item.value ? (
          <SizableText
            size="$bodyMdMedium"
            color={item.isWarning ? '$textCaution' : '$textSuccess'}
            textAlign="right"
          >
            {item.value}
          </SizableText>
        ) : null}

        <TokenSecurityAlertDialogContentIcon isWarning={item.isWarning} />
      </XStack>
    </XStack>
  );
}

export { TokenSecurityAlertDialogContentItem };
