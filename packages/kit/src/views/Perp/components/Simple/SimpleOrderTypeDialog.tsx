import { useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatHlPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  applySimpleAmountKey,
  getSimpleLimitPricePreset,
} from '../../utils/simpleTrading';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../PerpDialogLayout';
import { PerpsNativeAmountKeypad } from '../PerpsNativeAmountKeypad';

import type { IntlShape } from 'react-intl';

export type ISimpleOrderType = { type: 'market' | 'limit'; price: string };

type IProps = {
  value: ISimpleOrderType;
  side: 'long' | 'short';
  marketPrice: string;
  getMarketPrice: () => string;
  szDecimals: number;
  onConfirm: (value: ISimpleOrderType) => void;
};

function OrderTypeContent({
  value,
  side,
  marketPrice,
  getMarketPrice,
  szDecimals,
  onConfirm,
}: IProps) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [type, setType] = useState(value.type);
  const [price, setPrice] = useState(
    value.price || formatHlPrice(marketPrice, szDecimals),
  );
  const normalizedPrice = formatHlPrice(price, szDecimals);
  const validPrice =
    Boolean(normalizedPrice) && new BigNumber(normalizedPrice).eq(price);
  const updatePrice = (next: string) => {
    if (/^\d*\.?\d*$/.test(next)) setPrice(next);
  };
  const confirm = () => {
    if (type === 'limit' && !validPrice) return;
    onConfirm({ type, price: normalizedPrice });
    void dialog.close();
  };
  return (
    <YStack gap="$4">
      {(['market', 'limit'] as const).map((option) => (
        <YStack
          key={option}
          p="$4"
          gap="$2"
          borderRadius="$3"
          borderWidth="$px"
          borderColor={type === option ? '$borderActive' : '$borderSubdued'}
        >
          <YStack
            testID={`perps-simple-order-type-${option}`}
            gap="$1"
            accessibilityRole="radio"
            accessibilityState={{ checked: type === option }}
            onPress={() => setType(option)}
          >
            <SizableText size="$headingMd" fontWeight="600">
              {intl.formatMessage({
                id:
                  option === 'market'
                    ? ETranslations.perp_position_market
                    : ETranslations.perp_position_limit,
              })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id:
                  option === 'market'
                    ? ETranslations.perp_order_type_market_desc__desc
                    : ETranslations.perp_order_type_limit_desc__desc,
              })}
            </SizableText>
          </YStack>
          {option === 'limit' && type === 'limit' ? (
            <YStack gap="$2">
              {platformEnv.isNative ? (
                <YStack
                  bg="$bgSubdued"
                  borderRadius="$3"
                  px="$3"
                  py="$2"
                  minHeight={40}
                  justifyContent="center"
                >
                  <SizableText
                    size="$bodyLg"
                    fontWeight="400"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={intl.formatMessage(
                      {
                        id: ETranslations.perp_simple_limit_price_accessibility__desc,
                      },
                      { price: price || '--' },
                    )}
                  >
                    {price || '--'}
                  </SizableText>
                </YStack>
              ) : (
                <Input
                  testID="perps-simple-limit-price"
                  size="large"
                  value={price}
                  onChangeText={updatePrice}
                  placeholder={`${intl.formatMessage({ id: ETranslations.perp_orderbook_price })} (USD)`}
                />
              )}
              {price && !validPrice ? (
                <SizableText size="$bodySm" color="$textCritical">
                  {intl.formatMessage({
                    id: ETranslations.perp_simple_invalid_limit_price__msg,
                  })}
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
      ))}
      {type === 'limit' ? (
        <YStack gap="$2">
          <XStack gap="$2">
            {([0, 1, 2, 3] as const).map((percent) => (
              <Button
                key={percent}
                testID={`perps-simple-price-preset-${percent}`}
                flex={1}
                size="small"
                px="$1"
                minHeight={40}
                disabled={
                  !getSimpleLimitPricePreset(
                    marketPrice,
                    szDecimals,
                    percent,
                    side,
                  )
                }
                onPress={() =>
                  setPrice(
                    getSimpleLimitPricePreset(
                      getMarketPrice(),
                      szDecimals,
                      percent,
                      side,
                    ),
                  )
                }
              >
                {percent === 0
                  ? intl.formatMessage({
                      id: ETranslations.perp_order_mid_price_title,
                    })
                  : `${side === 'short' ? '+' : '-'}${percent}%`}
              </Button>
            ))}
          </XStack>
          {platformEnv.isNative ? (
            <PerpsNativeAmountKeypad
              hideCta
              onKeyPress={(key) =>
                updatePrice(applySimpleAmountKey(price, key))
              }
              onBackspaceLongPress={() => setPrice('')}
              ctaLabel={intl.formatMessage({
                id: ETranslations.global_confirm,
              })}
              onCtaPress={confirm}
            />
          ) : null}
        </YStack>
      ) : null}
      <XStack gap="$3" pt="$2">
        <Button
          testID="perps-simple-order-type-cancel"
          flex={1}
          size="large"
          onPress={() => dialog.close()}
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button
          testID="perps-simple-order-type-confirm"
          flex={1}
          size="large"
          variant="primary"
          disabled={type === 'limit' && !validPrice}
          onPress={confirm}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
    </YStack>
  );
}

export function showSimpleOrderTypeDialog(props: IProps, intl: IntlShape) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.perp_trade_order_type,
    }),
    showFooter: false,
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    renderContent: <OrderTypeContent {...props} />,
  });
}
