import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  IconButton,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function MemoValue({
  label,
  value,
  monospace = true,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  return (
    <YStack gap="$1">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {label}
        </SizableText>
        <IconButton
          testID={`zcash-memo-copy-${label}`}
          title={`${intl.formatMessage({ id: ETranslations.global_copy })} ${label}`}
          icon="Copy3Outline"
          size="small"
          variant="tertiary"
          onPress={() => copyText(value)}
        />
      </XStack>
      <ScrollView maxHeight="$32">
        <SizableText
          selectable
          fontFamily={monospace ? '$monoRegular' : undefined}
          size="$bodySm"
          style={
            platformEnv.isNative
              ? undefined
              : { wordBreak: 'break-all', whiteSpace: 'pre-wrap' }
          }
        >
          {value}
        </SizableText>
      </ScrollView>
    </YStack>
  );
}

export function ZcashMemo({
  text,
  binaryMemos,
}: {
  text?: string;
  binaryMemos?: { hex: string; hash: string }[];
}) {
  const intl = useIntl();
  if (!text && !binaryMemos?.length) return null;
  return (
    <YStack gap="$3" width="100%">
      {text ? (
        <MemoValue label="Memo" value={text} monospace={false} />
      ) : (
        <SizableText size="$bodyMdMedium">Memo · HEX</SizableText>
      )}
      {binaryMemos?.length ? (
        <Button
          testID="zcash-memo-raw-data"
          alignSelf="flex-start"
          size="small"
          variant="tertiary"
          onPress={() =>
            Dialog.show({
              title: intl.formatMessage({ id: ETranslations.raw_data__title }),
              renderContent: (
                <YStack gap="$3">
                  {binaryMemos.map((memo, index) => (
                    <YStack key={`${index}-${memo.hex}`} gap="$2">
                      <MemoValue label="HEX · ZIP 302" value={memo.hex} />
                      <MemoValue label="BLAKE2b-256" value={memo.hash} />
                    </YStack>
                  ))}
                </YStack>
              ),
              showCancelButton: false,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_ok,
              }),
            })
          }
        >
          {intl.formatMessage({ id: ETranslations.raw_data__title })}
        </Button>
      ) : null}
    </YStack>
  );
}
