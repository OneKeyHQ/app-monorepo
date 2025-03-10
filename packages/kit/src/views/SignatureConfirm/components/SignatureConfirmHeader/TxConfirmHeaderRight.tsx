import { memo } from 'react';

import {
  HeaderButtonGroup,
  HeaderIconButton,
  Popover,
  YStack,
  XStack,
  Stack,
  SizableText,
} from '@onekeyhq/components';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';
function TxConfirmHeaderRight() {
  const intl = useIntl();
  return (
    <HeaderButtonGroup>
      <Popover
        title={intl.formatMessage({ id: ETranslations.low_value_assets })}
        renderTrigger={<HeaderIconButton icon="ShieldCheckDoneOutline" />}
        renderContent={
          <YStack p="$5" gap="$2">
            {isString(helpText) ? (
              <SizableText>{helpText}</SizableText>
            ) : (
              helpText.map((text, index) => (
                <XStack key={index} gap="$2">
                  <Stack
                    w="$1.5"
                    h="$1.5"
                    bg="$textSubdued"
                    borderRadius="$full"
                    mt="$2"
                  />
                  <SizableText size="$bodyMd">{text}</SizableText>
                </XStack>
              ))
            )}
          </YStack>
        }
      />
    </HeaderButtonGroup>
  );
}

export default memo(TxConfirmHeaderRight);
