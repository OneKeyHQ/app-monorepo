import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function InfoItemGroup({ children, ...rest }: IXStackProps) {
  return (
    <XStack p="$2.5" flexWrap="wrap" {...rest}>
      {children}
    </XStack>
  );
}

export function InfoItem({
  label,
  renderContent,
  description,
  compact = false,
  showCopy = false,
  openWithUrl,
  disabledCopy = false,
  ...rest
}: {
  label?: string | ReactNode;
  renderContent?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  disabledCopy?: boolean;
  showCopy?: boolean;
  openWithUrl?: () => void;
} & IStackProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <Stack
      flex={1}
      flexBasis="100%"
      p="$2.5"
      space="$2"
      {...(compact && {
        $gtMd: {
          flexBasis: '50%',
        },
      })}
      {...rest}
    >
      {label ? (
        <>
          {typeof label === 'string' ? (
            <SizableText size="$bodyMdMedium">{label}</SizableText>
          ) : (
            label
          )}
        </>
      ) : null}
      {typeof renderContent === 'string' ? (
        <XStack alignItems="flex-start" justifyContent="space-between">
          <Stack flex={1} maxWidth="$96">
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              style={{ wordBreak: 'break-all' }}
              flex={1}
              {...(description && {
                mb: '$1',
              })}
            >
              {renderContent}
            </SizableText>
            {description || null}
          </Stack>
          {showCopy || openWithUrl ? (
            <XStack space="$3" ml="$5">
              {openWithUrl ? (
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_view_in_blockchain_explorer,
                  })}
                  variant="tertiary"
                  icon="OpenOutline"
                  size="small"
                  onPress={openWithUrl}
                />
              ) : null}
              {showCopy ? (
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  variant="tertiary"
                  icon="Copy1Outline"
                  size="small"
                  onPress={() => {
                    if (!disabledCopy) {
                      copyText(renderContent);
                    }
                  }}
                />
              ) : null}
            </XStack>
          ) : null}
        </XStack>
      ) : (
        renderContent
      )}
    </Stack>
  );
}
