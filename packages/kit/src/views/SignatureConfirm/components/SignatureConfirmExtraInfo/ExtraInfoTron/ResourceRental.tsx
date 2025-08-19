import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Accordion,
  Badge,
  Button,
  Dialog,
  Icon,
  SizableText,
  Switch,
  View,
  XStack,
  YStack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import {
  useSignatureConfirmActions,
  useTronResourceRentalInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import {
  settingsTronRentalPersistAtom,
  useSettingsTronRentalPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { ETronResourceRentalPayType } from '@onekeyhq/shared/types/fee';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

const showResourceRentalDetailsDialog = ({
  title,
  description,
  content,
  ...dialogProps
}: IDialogShowProps & {
  title: string;
  description: string;
  content: React.ReactNode;
}) =>
  Dialog.show({
    title,
    description,
    icon: 'FlashOutline',
    renderContent: content,
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });

function ResourceRentalLearnMoreButton({
  closeDialogAfterClick = true,
  openLinkInApp = true,
}: {
  closeDialogAfterClick?: boolean;
  openLinkInApp?: boolean;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const resourceRentalHelpLink = useHelpLink({
    path: 'articles/11461320',
  });
  return (
    <Button
      flex={1}
      textAlign="left"
      justifyContent="flex-start"
      size="small"
      variant="tertiary"
      icon="QuestionmarkOutline"
      onPress={() => {
        if (openLinkInApp) {
          openUrlInApp(resourceRentalHelpLink);
        } else {
          openUrlExternal(resourceRentalHelpLink);
        }
        if (closeDialogAfterClick) {
          void dialogInstance.close();
        }
      }}
    >
      {intl.formatMessage({
        id: ETranslations.global_learn_more,
      })}
    </Button>
  );
}

function ResourceRental() {
  const intl = useIntl();
  const [resourceRentalInfo] = useTronResourceRentalInfoAtom();
  const { gtMd } = useMedia();
  const { updateTronResourceRentalInfo } = useSignatureConfirmActions().current;
  const {
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    payType,
    payTokenInfo,
    saveTRX,
    resourcePrice,
  } = resourceRentalInfo;
  const [{ preventDisableTronRental }] = useSettingsTronRentalPersistAtom();

  const handleResourceRentalToggle = useCallback(
    (value: boolean) => {
      if (!preventDisableTronRental && !value) {
        void settingsTronRentalPersistAtom.set({
          preventDisableTronRental: true,
        });
        showResourceRentalDetailsDialog({
          title: intl.formatMessage({
            id: ETranslations.wallet_disable_energy_rental_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.wallet_disable_energy_rental_description,
          }),
          content: (
            <ResourceRentalLearnMoreButton
              closeDialogAfterClick={false}
              openLinkInApp={false}
            />
          ),
          onCancelText: intl.formatMessage({
            id: ETranslations.global_disable_button,
          }),
          onCancel: (close) => {
            updateTronResourceRentalInfo({ isResourceRentalEnabled: value });
            void close();
          },
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_cancel,
          }),
          onConfirm: ({ close }) => {
            void close();
          },
          showCancelButton: true,
        });
        return;
      }

      updateTronResourceRentalInfo({ isResourceRentalEnabled: value });
    },
    [intl, preventDisableTronRental, updateTronResourceRentalInfo],
  );

  const handleSwapTrxToggle = useCallback(
    (value: boolean) => {
      updateTronResourceRentalInfo({ isSwapTrxEnabled: value });
    },
    [updateTronResourceRentalInfo],
  );

  const renderSwapTrxBlock = useCallback(() => {
    if (payType === ETronResourceRentalPayType.Native) return null;

    if (!payTokenInfo || !payTokenInfo.extraTrxNum) return null;

    return (
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        collapsible
        defaultValue=""
        borderRadius="$2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        backgroundColor="transparent"
      >
        <Accordion.Item value="a1">
          <Accordion.Trigger
            flexDirection="row"
            justifyContent="space-between"
            px="$3"
            py="$2"
            backgroundColor="transparent"
            borderWidth={0}
          >
            {({ open }: { open: boolean }) => (
              <XStack
                flex={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.wallet_get_trx_for_future_fees,
                  })}
                </SizableText>
                <View
                  animation="quick"
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon name="ChevronDownSmallOutline" size="$6" />
                </View>
              </XStack>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              backgroundColor="transparent"
              animation="quick"
              exitStyle={{ opacity: 0 }}
              px="$3"
            >
              <XStack
                alignItems="center"
                gap="$2"
                justifyContent="space-between"
              >
                <YStack gap="$1">
                  <XStack>
                    <XStack
                      {...listItemPressStyle}
                      alignItems="center"
                      gap="$1.5"
                      px="$1"
                      mx="$-1"
                      userSelect="none"
                      borderRadius="$1"
                      onPress={() =>
                        showResourceRentalDetailsDialog({
                          title: intl.formatMessage(
                            {
                              id: ETranslations.wallet_exchange_usdt_for_trx,
                            },
                            {
                              price_usdt: payTokenInfo?.payPurchaseTrxAmount,
                              price_trx: payTokenInfo?.extraTrxNum,
                            },
                          ),
                          description: intl.formatMessage({
                            id: ETranslations.wallet_exchange_usdt_description,
                          }),
                          content: (
                            <SizableText size="$bodySm" color="$textSubdued">
                              {intl.formatMessage(
                                {
                                  id: ETranslations.wallet_exchange_rate,
                                },
                                {
                                  price_usdt: new BigNumber(
                                    payTokenInfo?.exchangeFee ?? 0,
                                  )
                                    .plus(1)
                                    .times(payTokenInfo?.trxRatio ?? 0)
                                    .toFixed(),
                                  price_trx: '1',
                                },
                              )}
                            </SizableText>
                          ),
                        })
                      }
                    >
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage(
                          {
                            id: ETranslations.wallet_exchange_usdt_for_trx,
                          },
                          {
                            price_usdt: payTokenInfo?.payPurchaseTrxAmount,
                            price_trx: payTokenInfo?.extraTrxNum,
                          },
                        )}
                      </SizableText>
                      <Icon
                        name="InfoCircleOutline"
                        size="$4.5"
                        color="$iconSubdued"
                      />
                    </XStack>
                  </XStack>
                </YStack>
                <Switch
                  size={gtMd ? 'small' : 'large'}
                  value={isSwapTrxEnabled}
                  onChange={handleSwapTrxToggle}
                />
              </XStack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    );
  }, [
    payType,
    payTokenInfo,
    intl,
    gtMd,
    isSwapTrxEnabled,
    handleSwapTrxToggle,
  ]);

  if (!isResourceRentalNeeded) {
    return null;
  }

  return (
    <YStack gap="$1">
      <SignatureConfirmItem.Block>
        <XStack alignItems="center" gap="$2" justifyContent="space-between">
          <YStack flex={1} gap="$1">
            <XStack>
              <XStack
                {...listItemPressStyle}
                alignItems="center"
                gap="$1.5"
                flexWrap="wrap"
                px="$1"
                mx="$-1"
                userSelect="none"
                borderRadius="$1"
                onPress={() =>
                  showResourceRentalDetailsDialog({
                    title: intl.formatMessage({
                      id: ETranslations.wallet_energy_rental_title,
                    }),
                    description: intl.formatMessage(
                      {
                        id: ETranslations.wallet_energy_rental_description,
                      },
                      {
                        price: resourcePrice.price,
                        min: resourcePrice.minutes,
                      },
                    ),
                    content: <ResourceRentalLearnMoreButton />,
                  })
                }
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.wallet_energy_rental_title,
                  })}
                </SizableText>
                {payType === ETronResourceRentalPayType.Native ? (
                  <Badge badgeSize="sm" badgeType="success">
                    <XStack alignItems="center" gap="$1">
                      <Icon name="FlashSolid" size="$4" color="$iconSuccess" />
                      <SizableText size="$bodySmMedium" color="$textSuccess">
                        {intl.formatMessage(
                          {
                            id: ETranslations.wallet_save_amount,
                          },
                          { number: saveTRX ?? '0' },
                        )}
                      </SizableText>
                    </XStack>
                  </Badge>
                ) : (
                  <Badge badgeSize="sm" badgeType="success">
                    {intl.formatMessage({
                      id: ETranslations.wallet_pay_with_usdt,
                    })}
                  </Badge>
                )}
                <Icon
                  name="InfoCircleOutline"
                  size="$4.5"
                  color="$iconSubdued"
                />
              </XStack>
            </XStack>

            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id:
                  payType === ETronResourceRentalPayType.Native
                    ? ETranslations.wallet_energy_rental_low_energy_detected
                    : ETranslations.wallet_energy_rental_insufficient_trx,
              })}
            </SizableText>
          </YStack>
          <Switch
            size={gtMd ? 'small' : 'large'}
            value={isResourceRentalEnabled}
            onChange={handleResourceRentalToggle}
          />
        </XStack>
      </SignatureConfirmItem.Block>
      {renderSwapTrxBlock()}
    </YStack>
  );
}

export default ResourceRental;
