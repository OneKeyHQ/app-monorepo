import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { AddressBadge } from '@onekeyhq/kit/src/components/AddressBadge';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { BaseInput } from '@onekeyhq/kit/src/components/BaseInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';

type ISwapIncognitoRecipientInputProps = {
  visible: boolean;
  errorMessage?: string;
  inputText: string;
  loading: boolean;
  onOpenRecipientAddress: () => void;
  onInputChange: (text: string) => void;
  queryResult: IAddressQueryResult;
};

function useSwapRecipientInputHeight() {
  const [baseHeight, setBaseHeight] = useState<number>();
  const [height, setHeight] = useState<number>();

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextBaseHeight = Math.ceil(event.nativeEvent.layout.height);

    setBaseHeight((prevHeight) => prevHeight ?? nextBaseHeight);
    setHeight((prevHeight) => prevHeight ?? nextBaseHeight);
  }, []);

  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      if (!platformEnv.isNative) {
        return;
      }

      const nextHeight = Math.max(
        Math.ceil(event.nativeEvent.contentSize.height),
        baseHeight ?? 0,
      );

      setHeight((prevHeight) =>
        prevHeight === nextHeight ? prevHeight : nextHeight,
      );
    },
    [baseHeight],
  );

  return {
    height,
    onContentSizeChange: handleContentSizeChange,
    onLayout: handleLayout,
  };
}

export function SwapIncognitoRecipientInput({
  visible,
  errorMessage,
  inputText,
  loading,
  onOpenRecipientAddress,
  onInputChange,
  queryResult,
}: ISwapIncognitoRecipientInputProps) {
  const intl = useIntl();
  const { height, onContentSizeChange, onLayout } =
    useSwapRecipientInputHeight();

  const badgeItems = useMemo(() => {
    if (loading || queryResult.validStatus !== 'valid') {
      return null;
    }

    const interactionBadges = queryResult.addressBadges ?? [];

    if (
      !queryResult.walletAccountName &&
      !queryResult.addressBookName &&
      interactionBadges.length === 0
    ) {
      return null;
    }

    return (
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        {queryResult.walletAccountName ? (
          <Badge badgeType="success" badgeSize="sm">
            {queryResult.walletAccountName}
          </Badge>
        ) : null}
        {queryResult.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm">
            {queryResult.addressBookName}
          </Badge>
        ) : null}
        {interactionBadges.map((badge) => (
          <AddressBadge
            key={`${badge.label}-${badge.type}`}
            title={badge.label}
            badgeType={badge.type}
            content={badge.tip}
            icon={badge.icon}
          />
        ))}
      </XStack>
    );
  }, [
    loading,
    queryResult.addressBadges,
    queryResult.addressBookName,
    queryResult.validStatus,
    queryResult.walletAccountName,
  ]);

  if (!visible) {
    return null;
  }

  return (
    <Stack gap="$2">
      <Stack position="relative">
        <BaseInput
          value={inputText}
          onChangeText={onInputChange}
          numberOfLines={1}
          size="large"
          placeholder={intl.formatMessage({
            id: ETranslations.trade_enter_receiver_address_optional,
          })}
          error={!!errorMessage}
          pr="$11"
          scrollEnabled={false}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          height={height}
        />
        <XStack
          position="absolute"
          top={0}
          bottom={0}
          right="$2"
          alignItems="center"
        >
          <IconButton
            variant="tertiary"
            size="small"
            icon="PeopleCircleOutline"
            onPress={onOpenRecipientAddress}
          />
        </XStack>
      </Stack>

      {errorMessage ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {errorMessage}
        </SizableText>
      ) : null}

      {badgeItems}

      {!errorMessage ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_page_recipient_modal_do_not,
          })}
        </SizableText>
      ) : null}
    </Stack>
  );
}
