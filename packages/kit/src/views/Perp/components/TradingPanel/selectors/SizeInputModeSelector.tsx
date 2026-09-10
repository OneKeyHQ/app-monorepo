import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  useInPageDialog,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

export interface ISizeInputModeSelectorProps {
  value: 'token' | 'usd' | 'margin';
  onChange: (value: 'token' | 'usd' | 'margin') => void;
  tokenSymbol: string;
  allowMarginInput?: boolean;
}

function SizeInputModeContent({
  value: initialValue,
  onChange: onValueChange,
  tokenSymbol,
  allowMarginInput = true,
}: ISizeInputModeSelectorProps) {
  const intl = useIntl();
  const [value, setValue] = useState(initialValue);
  const onChange = useCallback(
    (nextValue: ISizeInputModeSelectorProps['value']) => {
      setValue(nextValue);
      onValueChange(nextValue);
    },
    [onValueChange],
  );
  const tokenFallbackLabel = intl.formatMessage({
    id: ETranslations.wallet_bulk_send_approval_token_fallback,
  });
  const resolvedValue = !allowMarginInput && value === 'margin' ? 'usd' : value;
  const isTokenSelected = resolvedValue === 'token';
  const isUsdSelected = resolvedValue === 'usd' || resolvedValue === 'margin';
  const usdDesc = allowMarginInput
    ? intl.formatMessage({
        id: ETranslations.perp_size_input_usd_desc,
      })
    : intl.formatMessage(
        { id: ETranslations.perp_size_input_token_desc },
        { token: 'USD' },
      );

  const handleUsdCardPress = useCallback(() => {
    if (!isUsdSelected) {
      onChange('usd');
    }
  }, [isUsdSelected, onChange]);

  const renderRadioItem = (
    label: string,
    checked: boolean,
    onPress: () => void,
  ) => (
    <XStack
      alignItems="center"
      gap="$2"
      cursor="default"
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <XStack
        w="$4"
        h="$4"
        borderRadius="$full"
        borderWidth={1.5}
        borderColor={checked ? '$borderActive' : '$borderStrong'}
        bg={checked ? '$bgPrimary' : 'transparent'}
        alignItems="center"
        justifyContent="center"
      >
        {checked ? (
          <XStack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInverse" />
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" color="$text">
        {label}
      </SizableText>
    </XStack>
  );

  return (
    <YStack gap="$4">
      <YStack
        p="$4"
        gap="$2.5"
        borderRadius="$3"
        borderWidth={1}
        borderColor={isTokenSelected ? '$borderActive' : '$borderSubdued'}
        onPress={() => onChange('token')}
        cursor="default"
        hoverStyle={{
          bg: '$bgHover',
        }}
      >
        <YStack gap="$1">
          <SizableText size="$headingMd" fontWeight="600" color="$text">
            {tokenSymbol || tokenFallbackLabel}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.perp_size_input_token_desc },
              {
                token: tokenSymbol || tokenFallbackLabel,
              },
            )}
          </SizableText>
        </YStack>
      </YStack>

      <YStack
        p="$4"
        gap="$2.5"
        borderRadius="$3"
        borderWidth={1}
        borderColor={isUsdSelected ? '$borderActive' : '$borderSubdued'}
        onPress={handleUsdCardPress}
        cursor="default"
        hoverStyle={{
          bg: '$bgHover',
        }}
      >
        <YStack gap="$1">
          <SizableText size="$headingMd" fontWeight="600" color="$text">
            USD
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {usdDesc}
          </SizableText>
        </YStack>

        <XStack gap="$6" flexWrap="wrap">
          {renderRadioItem(
            intl.formatMessage({
              id: ETranslations.perp_size_input_usd_order_size,
            }),
            resolvedValue === 'usd',
            () => onChange('usd'),
          )}
          {allowMarginInput
            ? renderRadioItem(
                intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_order_cost,
                }),
                resolvedValue === 'margin',
                () => onChange('margin'),
              )
            : null}
        </XStack>
      </YStack>
    </YStack>
  );
}

export function SizeInputModeSelector(props: ISizeInputModeSelectorProps) {
  const { value, tokenSymbol, allowMarginInput = true, onChange } = props;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const handleChange = useCallback(
    (nextValue: ISizeInputModeSelectorProps['value']) => {
      onChangeRef.current(nextValue);
    },
    [],
  );
  const intl = useIntl();
  const dialog = useInPageDialog();
  const resolvedValue = !allowMarginInput && value === 'margin' ? 'usd' : value;
  const tokenFallbackLabel = intl.formatMessage({
    id: ETranslations.wallet_bulk_send_approval_token_fallback,
  });

  const handlePress = () => {
    const dialogInstance = platformEnv.isNativeAndroid ? Dialog : dialog;
    dialogInstance.show({
      title: intl.formatMessage({ id: ETranslations.perp_size_input_title }),
      floatingPanelProps: platformEnv.isNativeAndroid
        ? undefined
        : { width: 400 },
      contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
      renderContent: (
        <SizeInputModeContent {...props} onChange={handleChange} />
      ),
      showFooter: false,
    });
  };

  return (
    <XStack
      alignItems="center"
      gap="$1"
      userSelect="none"
      cursor="default"
      onPress={handlePress}
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {resolvedValue === 'token' ? tokenSymbol || tokenFallbackLabel : 'USD'}
      </SizableText>
      <Icon
        name="ChevronTriangleDownSmallSolid"
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );
}
