import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  SLIPPAGE_INPUT_FOCUS_BORDER_COLOR,
  SlippageInput,
} from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { useDustSweep } from '../DustSweepProvider';
import { getDustSweepSlippageNotice } from '../utils/candidates';

// Preset cell widths from the Figma slippage popover (150px with 1px dividers).
const SLIPPAGE_PRESETS = [
  { value: 5, width: 44 },
  { value: 10, width: 51 },
  { value: 20, width: 53 },
];

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
  const [inputFocused, setInputFocused] = useState(false);
  const inputHeight = mobile ? 44 : 38;
  const notice = getDustSweepSlippageNotice(draft);
  const valid = notice !== 'invalid';
  let message: string | undefined;
  if (notice === 'invalid') {
    message = intl.formatMessage({
      id: ETranslations.slippage_tolerance_error_message,
    });
  } else if (notice === 'tooLow') {
    message = intl.formatMessage(
      { id: ETranslations.slippage_tolerance_warning_message_2 },
      { number: swapSlippageWillFailMinValue },
    );
  } else if (notice === 'tooHigh') {
    message = intl.formatMessage(
      { id: ETranslations.slippage_tolerance_warning_message_1 },
      { number: swapSlippageWillAheadMinValue },
    );
  }
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
            onFocus: () => setInputFocused(true),
            onBlur: () => setInputFocused(false),
            // Same input styling as the Swap review slippage editor.
            containerProps: {
              flex: 1,
              minWidth: 0,
              height: inputHeight,
              borderRadius: '$3',
              bg: '$bgStrong',
              borderColor: inputFocused
                ? SLIPPAGE_INPUT_FOCUS_BORDER_COLOR
                : '$borderStrong',
              borderWidth: inputFocused ? 1.5 : '$px',
            },
          }}
        />
        {/* Same preset row pattern as the Swap review slippage editor. */}
        <XStack height={inputHeight}>
          {SLIPPAGE_PRESETS.map(({ value, width }, index) => (
            <XStack key={value}>
              {index ? <Divider vertical /> : null}
              <Button
                testID={`dust-sweep-slippage-${value}`}
                variant="secondary"
                width={width}
                height={inputHeight}
                minHeight={inputHeight}
                px={0}
                mx={0}
                my={0}
                borderTopLeftRadius={index === 0 ? '$3' : 0}
                borderBottomLeftRadius={index === 0 ? '$3' : 0}
                borderTopRightRadius={
                  index === SLIPPAGE_PRESETS.length - 1 ? '$3' : 0
                }
                borderBottomRightRadius={
                  index === SLIPPAGE_PRESETS.length - 1 ? '$3' : 0
                }
                childrenAsText={false}
                onPress={() => setDraft(value.toString())}
              >
                <SizableText size="$bodyMd">{`${value}%`}</SizableText>
              </Button>
            </XStack>
          ))}
        </XStack>
      </XStack>
      {message ? (
        <SizableText
          testID="dust-sweep-slippage-message"
          mt="$2"
          size="$bodyMd"
          color={valid ? '$textCaution' : '$textCritical'}
        >
          {message}
        </SizableText>
      ) : null}
      <Button
        testID="dust-sweep-slippage-confirm"
        mt="$4"
        variant="primary"
        height={mobile ? 50 : 38}
        minHeight={mobile ? 50 : 38}
        // Desktop popover uses the 8px radius from the Figma design. Passing
        // borderRadius={undefined} would drop the default pill radius on mobile.
        {...(!mobile && { borderRadius: '$2' })}
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
  const displayValue = `${slippage}%`;
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
        <SizableText
          size="$bodyMdMedium"
          color={
            slippage > swapSlippageWillAheadMinValue ? '$textCaution' : '$text'
          }
        >
          {displayValue}
        </SizableText>
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
