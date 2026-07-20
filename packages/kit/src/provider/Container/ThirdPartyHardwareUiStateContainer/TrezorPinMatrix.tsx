import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Dialog, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Trezor host PIN matrix for old button devices. Like OneKey HD's EnterPin but
// with no `0` and no on-device button (matches Trezor Suite). Blank grid: the
// scrambled digits live on the device; we send the tapped position string.
export function TrezorPinMatrix({
  title,
  onConfirm,
}: {
  title: string;
  onConfirm: (value: string) => void;
}) {
  const [val, setVal] = useState('');
  const intl = useIntl();

  const varMask = useMemo(
    () =>
      val
        .split('')
        .map((v) => (v ? '•' : ''))
        .join(''),
    [val],
  );

  const keyboardMap = useMemo(
    () => [
      '7',
      '8',
      '9',
      /**/
      '4',
      '5',
      '6',
      /**/
      '1',
      '2',
      '3',
      /**/
      'delete',
      // Trezor has no `0` position — keep the slot blank.
      '',
      'confirm',
    ],
    [],
  );

  const onDelete = useCallback(() => {
    setVal((v) => v.slice(0, -1));
  }, []);

  const onPress = useCallback(
    (num: string) => {
      if (num === '') {
        return;
      }
      if (num === 'delete') {
        onDelete();
        return;
      }
      if (num === 'confirm') {
        if (val.length === 0) return;
        onConfirm(val);
        return;
      }
      setVal((v) => {
        // classic only supports 9 digits
        if (v.length >= 9) {
          return v;
        }
        return v + num;
      });
    },
    [onConfirm, onDelete, val],
  );

  const getButtonType = useCallback((item: string) => {
    if (item === 'delete') return 'delete';
    if (item === 'confirm') return 'confirm';
    return 'number';
  }, []);

  const buttonStyles = useMemo(
    () => ({
      delete: { bg: '$bgSubdued', hoverBg: '$bgHover', pressBg: '$bgActive' },
      confirm: {
        bg: '$bgPrimary',
        hoverBg: '$bgPrimaryHover',
        pressBg: '$bgPrimaryActive',
      },
      number: { bg: '$bgSubdued', hoverBg: '$bgHover', pressBg: '$bgActive' },
    }),
    [],
  );

  const getButtonBg = useCallback(
    (item: string, state: 'default' | 'hover' | 'press') => {
      const style = buttonStyles[getButtonType(item)];
      if (state === 'hover') return style.hoverBg;
      if (state === 'press') return style.pressBg;
      return style.bg;
    },
    [buttonStyles, getButtonType],
  );

  const renderKeyboardItem = useCallback((num: string) => {
    if (num === '') return null;
    if (num === 'delete') {
      return <Icon size="$8" name="XBackspaceOutline" color="$iconStrong" />;
    }
    if (num === 'confirm') {
      return <Icon size="$5" name="CheckLargeOutline" color="$iconInverse" />;
    }
    return <Stack w="$2.5" h="$2.5" borderRadius="$full" bg="$text" />;
  }, []);

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>
          {intl.formatMessage({ id: ETranslations.enter_pin_desc })}
        </Dialog.Description>
      </Dialog.Header>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$bgApp"
        borderRadius="$3"
        overflow="hidden"
        borderCurve="continuous"
      >
        <XStack
          h="$12"
          alignItems="center"
          px="$3"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderColor="$bgApp"
          bg="$bgSubdued"
        >
          <SizableText
            userSelect="none"
            textAlign="center"
            flex={1}
            size="$heading4xl"
          >
            {varMask}
          </SizableText>
        </XStack>
        <XStack flexWrap="wrap">
          {keyboardMap.map((num, index) => {
            const isLastColumn = (index + 1) % 3 === 0;
            const isLastRow = index >= 9;
            return (
              <Stack
                key={index}
                testID={`trezor-pin-key-${num}`}
                flexBasis="33.3333%"
                h="$14"
                borderRightWidth={isLastColumn ? 0 : StyleSheet.hairlineWidth}
                borderBottomWidth={isLastRow ? 0 : StyleSheet.hairlineWidth}
                borderColor="$bgApp"
                justifyContent="center"
                alignItems="center"
                bg={getButtonBg(num, 'default')}
                hoverStyle={
                  num === '' ? undefined : { bg: getButtonBg(num, 'hover') }
                }
                pressStyle={
                  num === '' ? undefined : { bg: getButtonBg(num, 'press') }
                }
                focusable={num !== ''}
                onPress={() => onPress(num)}
              >
                {renderKeyboardItem(num)}
              </Stack>
            );
          })}
        </XStack>
      </Stack>
    </Stack>
  );
}
