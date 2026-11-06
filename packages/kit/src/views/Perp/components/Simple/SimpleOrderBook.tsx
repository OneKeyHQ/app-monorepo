import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ScrollView, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PerpOrderBook } from '../PerpOrderBook';

import { simplePerpsCardStyle } from './simpleStyles';

export function SimpleOrderBook({ coin }: { coin: string }) {
  const intl = useIntl();
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const title = intl.formatMessage({ id: ETranslations.perps_order_book });
  useEffect(
    () => () => {
      void dialogRef.current?.close();
      dialogRef.current = undefined;
    },
    [coin],
  );
  const openOrderBook = useCallback(() => {
    if (dialogRef.current) return;
    dialogRef.current = Dialog.show({
      title,
      showFooter: false,
      contentContainerProps: { p: '$0' },
      renderContent: (
        <PerpsAccountSelectorProviderMirror>
          <PerpsProviderMirror>
            <ScrollView maxHeight={520}>
              <PerpOrderBook
                entry="perpMobileMarket"
                backgroundColor="$bg"
                readOnly
              />
            </ScrollView>
          </PerpsProviderMirror>
        </PerpsAccountSelectorProviderMirror>
      ),
      onClose: () => {
        dialogRef.current = undefined;
      },
    });
  }, [title]);
  return (
    <YStack gap="$3">
      <SizableText size="$headingLg">{title}</SizableText>
      <YStack
        testID="perps-simple-order-book"
        {...simplePerpsCardStyle}
        borderRadius="$6"
        p="$5"
        gap="$4"
        onPress={openOrderBook}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_simple_order_book_volume__desc,
          })}
        </SizableText>
        <YStack pointerEvents="none">
          <PerpOrderBook entry="perpMobileMarket" summaryOnly readOnly />
        </YStack>
      </YStack>
    </YStack>
  );
}
