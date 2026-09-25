import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { SlippageInput } from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { useDustSweep } from '../DustSweepProvider';
import { isValidDustSweepSlippage } from '../utils/candidates';

function SlippageEditor({
  initialValue,
  mobile,
  onClose,
  onConfirm,
}: {
  initialValue: number;
  mobile: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
}) {
  const intl = useIntl();
  const [draft, setDraft] = useState(initialValue.toString());
  const valid = isValidDustSweepSlippage(draft);
  const inputHeight = mobile ? 44 : 38;
  return (
    <YStack
      testID="dust-sweep-slippage-editor"
      px={mobile ? '$5' : '$4'}
      pt={mobile ? '$5' : '$4'}
      pb="$4"
      width="100%"
    >
      {mobile ? (
        <>
          <Stack
            position="absolute"
            top={4}
            left="50%"
            x={-20}
            width={40}
            height={5}
            bg="$bgStrong"
            borderRadius="$full"
          />
          <XStack height={28} alignItems="center" gap="$2" mb={30}>
            <IconButton
              testID="dust-sweep-slippage-close"
              icon="ChevronLeftOutline"
              size="small"
              variant="tertiary"
              mx={0}
              my={0}
              p={0}
              width={24}
              height={28}
              onPress={onClose}
            />
            <SizableText size="$headingXl">
              {intl.formatMessage({
                id: ETranslations.trade_silp_edit_slippage,
              })}
            </SizableText>
          </XStack>
        </>
      ) : null}
      <XStack gap="$2" height={inputHeight}>
        <SlippageInput
          testID="dust-sweep-slippage-input"
          swapSlippage={{
            key: ESwapSlippageSegmentKey.CUSTOM,
            value: draft ? Number(draft) : undefined,
          }}
          onChangeText={setDraft}
          props={{
            autoFocus: true,
            size: mobile ? 'large' : 'medium',
            height: inputHeight,
            containerProps: { flex: 1, minWidth: 0, height: inputHeight },
          }}
        />
        <XStack width={150} bg="$bgStrong" borderRadius="$3" overflow="hidden">
          {[5, 10, 20].map((value, index) => (
            <Button
              testID={`dust-sweep-slippage-${value}`}
              key={value}
              flex={1}
              height={inputHeight}
              minHeight={inputHeight}
              borderRadius={0}
              variant="tertiary"
              mx={0}
              my={0}
              borderLeftWidth={index ? 1 : 0}
              borderColor="$borderSubdued"
              px={0}
              onPress={() => setDraft(value.toString())}
            >
              {value}%
            </Button>
          ))}
        </XStack>
      </XStack>
      {!valid ? (
        <SizableText mt="$2" size="$bodyMd" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.slippage_tolerance_error_message,
          })}
        </SizableText>
      ) : null}
      <Button
        testID="dust-sweep-slippage-confirm"
        mt="$4"
        variant="primary"
        height={mobile ? 50 : 38}
        minHeight={mobile ? 50 : 38}
        disabled={!valid}
        onPress={() => onConfirm(Number(draft))}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
    </YStack>
  );
}

export function DustSweepSlippage() {
  const { slippage, setSlippage } = useDustSweep();
  const intl = useIntl();
  const media = useMedia();
  const mobile = platformEnv.isNative || media.md;
  const openEditor = useCallback(() => {
    const dialog = Dialog.show({
      testID: 'dust-sweep-slippage-sheet',
      nativeSheet: true,
      boundedSheetLayout: true,
      showHeader: false,
      showFooter: false,
      disableDrag: true,
      contentContainerProps: { px: 0, pb: 0 },
      renderContent: (
        <SlippageEditor
          initialValue={slippage}
          mobile
          onClose={() => {
            void dialog.close();
          }}
          onConfirm={(value) => {
            setSlippage(value);
            void dialog.close();
          }}
        />
      ),
    });
  }, [setSlippage, slippage]);
  const trigger = (
    <Button
      testID="dust-sweep-slippage"
      variant="tertiary"
      mx={0}
      my={0}
      size="small"
      p={0}
      height={20}
      minHeight={20}
      onPress={mobile ? openEditor : undefined}
    >
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyMdMedium">{slippage}%</SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" />
      </XStack>
    </Button>
  );
  return mobile ? (
    trigger
  ) : (
    <Popover
      title={intl.formatMessage({ id: ETranslations.trade_silp_edit_slippage })}
      showHeader={false}
      placement="bottom-end"
      floatingPanelProps={{ width: 340, p: 0 }}
      renderTrigger={trigger}
      renderContent={({ closePopover }) => (
        <SlippageEditor
          initialValue={slippage}
          mobile={false}
          onClose={closePopover}
          onConfirm={(value) => {
            setSlippage(value);
            closePopover();
          }}
        />
      )}
    />
  );
}
