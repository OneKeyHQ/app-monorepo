import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Modal,
  Pressable,
  RichTooltip,
  ScrollView,
  Skeleton,
  Slider,
  Spinner,
  Text,
  ToastManager,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { INSCRIPTION_PADDING_SATS_VALUES } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/consts';
import type { IInscriptionsOrder } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalanceTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import { useSingleToken } from '../../../hooks/useTokens';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { formatBytes } from '../../../utils/hardware/homescreens';
import {
  showAccountBalanceDetailsOverlay,
  useAccountBalanceDetailsInfo,
} from '../../Overlay/AccountBalanceDetailsPanel';
import HeaderDescription from '../Components/HeaderDescription';
import Steps from '../Components/Steps';
import { OrderButton } from '../OrderList';

import CreateOrderFilePreview from './CreateOrderFilePreview';

import type { InscribeModalRoutes } from '../../../routes/routesEnum';
import type { SendFeedbackReceiptParams } from '../../Send/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

type RouteProps = RouteProp<
  InscribeModalRoutesParams,
  InscribeModalRoutes.CreateOrder
>;

const TipWithLabel: FC<{ label: string }> = ({ label }) => (
  <RichTooltip
    // eslint-disable-next-line
    trigger={({ ...props }) => (
      <Pressable {...props}>
        <Icon name="InformationCircleMini" size={16} color="icon-subdued" />
      </Pressable>
    )}
    bodyProps={{
      children: <Text>{label}</Text>,
    }}
  />
);

const CreateOrder: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { networkId, accountId, receiveAddress, contents, size, file } =
    route?.params || {};
  const { serviceInscribe } = backgroundApiProxy;
  const { account, network } = useActiveSideAccount({ accountId, networkId });
  const [sat, setSat] = useState<number>(
    INSCRIPTION_PADDING_SATS_VALUES.default,
  );
  const isVerticalLayout = useIsVerticalLayout();
  const isSendConfirm = useRef<boolean>(false);

  const [order, updateOrder] = useState<IInscriptionsOrder>();
  const { token: tokenInfo } = useSingleToken(networkId, '');
  const closeModal = useModalClose();
  const [loading, setLoading] = useState(true);
  const isFirst = useRef(true);
  const refreshData = useCallback(
    async (padding?: number) => {
      setLoading(true);
      const feeRates = await serviceInscribe.fetchFeeRates();
      if (feeRates) {
        const data = await serviceInscribe.createInscribeOrder({
          toAddress: receiveAddress,
          contents,
          feeRate: feeRates.fastestFee,
          globalPaddingSats: padding,
        });
        updateOrder(data);
        setLoading(false);
        return data;
      }
    },
    [contents, receiveAddress, serviceInscribe],
  );

  const previewText = useMemo(() => {
    const content = contents[0];
    if (content && content.categoryType === 'text') {
      return bufferUtils.hexToText(content.hex);
    }
  }, [contents]);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      refreshData(INSCRIPTION_PADDING_SATS_VALUES.default);
    }
  }, [refreshData]);

  const [submitOrderLoading, setsSubmitOrderLoading] = useState(false);
  const [isButtonLoading, setButtonLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!account || !network || !tokenInfo || !order) {
      return;
    }
    const data = await refreshData(sat);
    if (data === undefined) {
      return;
    }

    setButtonLoading(true);
    try {
      const fundingEncodedTx =
        await serviceInscribe.buildInscribeCommitEncodedTx({
          to: data.fundingAddress,
          amount: data.fundingValueNative,
        });

      const submitOrder = async (commitSignedTx?: ISignedTxPro) => {
        setTimeout(() => {
          setsSubmitOrderLoading(true);
        }, 500);
        try {
          const result = await serviceInscribe.submitInscribeOrder({
            order,
            commitSignedTx,
          });
          closeModal();
          if (result.errors.length > 0) {
            ToastManager.show(
              {
                title: result.errors[0].message,
              },
              { type: 'error' },
            );
          } else if (result.txids.length > 0) {
            const params: SendFeedbackReceiptParams = {
              networkId,
              accountId,
              txid: result.txids[0],
              type: 'Send',
              isSingleTransformMode: true,
            };
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendModalRoutes.SendFeedbackReceipt,
                params,
              },
            });
          }
        } catch (error: any) {
          debugLogger.common.error('submitOrder error = ', error);
          setsSubmitOrderLoading(false);
          isSendConfirm.current = false;
          const { message } = error;
          if (message) {
            ToastManager.show(
              {
                title: message,
              },
              { type: 'error' },
            );
          }
        }
      };

      if (!fundingEncodedTx) {
        await submitOrder();
      } else {
        setsSubmitOrderLoading(true);
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.SendConfirm,
            params: {
              accountId,
              networkId,
              signOnly: true,
              feeInfoEditable: true,
              feeInfoUseFeeInTx: false,
              hideSendFeedbackReceipt: true,
              hideAdvancedSetting: true,
              encodedTx: fundingEncodedTx,
              onSuccess: async (commitSignedTx) => {
                isSendConfirm.current = true;
                await submitOrder(commitSignedTx);
              },
              onModalClose: () => {
                if (isSendConfirm.current === false) {
                  setsSubmitOrderLoading(false);
                }
              },
            },
          },
        });
      }
      setButtonLoading(false);
    } catch (error: any) {
      console.error(error);
      setButtonLoading(false);

      const { key, message } = error;
      ToastManager.show(
        {
          title:
            key === 'form__amount_invalid'
              ? intl.formatMessage({ id: 'msg__insufficient_balance' })
              : message,
        },
        { type: 'error' },
      );
    }
    //
  }, [
    account,
    accountId,
    closeModal,
    intl,
    navigation,
    network,
    networkId,
    order,
    refreshData,
    sat,
    serviceInscribe,
    tokenInfo,
  ]);

  const balanceDetailsInfo = useAccountBalanceDetailsInfo({
    networkId,
    accountId,
  });

  const AvailableBalance = useMemo(
    () => (
      <Box position="absolute" bottom={isVerticalLayout ? 0 : -72} left={0}>
        <Pressable
          onPress={
            balanceDetailsInfo.enabled
              ? () =>
                  showAccountBalanceDetailsOverlay({
                    info: balanceDetailsInfo,
                  })
              : undefined
          }
        >
          <Text typography="Caption" color="text-subdued">
            {intl.formatMessage({ id: 'form__available_balance' })}
          </Text>
          <Box alignItems="center" flexDirection="row">
            <FormatBalanceTokenOfAccount
              accountId={accountId}
              networkId={networkId}
              token={{
                id: tokenInfo?.id ?? '',
                name: tokenInfo?.name ?? '',
                ...(tokenInfo || {}),
              }}
              render={(ele) => <Text typography="Body1Strong">{ele}</Text>}
            />
            {balanceDetailsInfo.enabled ? (
              <Box ml={2}>
                <Icon name="InformationCircleSolid" size={18} />
              </Box>
            ) : null}
          </Box>
        </Pressable>
      </Box>
    ),
    [
      accountId,
      balanceDetailsInfo,
      intl,
      isVerticalLayout,
      networkId,
      tokenInfo,
    ],
  );
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe' })}
      headerDescription={<HeaderDescription network={network} />}
      rightContent={<OrderButton />}
      footer={submitOrderLoading ? null : undefined}
      height="640px"
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        onPress: onSubmit,
        isLoading: isButtonLoading,
        isDisabled: loading,
      }}
      hideSecondaryAction
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
    >
      {submitOrderLoading ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <VStack flex={1} justifyContent="space-between">
          <ScrollView
            mx="-16px"
            bounces={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            <Steps numberOfSteps={3} currentStep={3} />
            <Text mt="16px" typography="Heading">
              {intl.formatMessage({ id: 'form__inscribe_preview' })}
            </Text>
            <Text
              mt="16px"
              mb="8px"
              typography="Body1Strong"
              color="text-subdued"
            >
              {intl.formatMessage({ id: 'form__inscription_file_preview' })}
            </Text>
            <CreateOrderFilePreview file={file} text={previewText} />
            <Box mt="16px" flexDirection="row" justifyContent="space-between">
              <Box flexDirection="row" alignItems="center">
                <Text typography="Body1Strong" color="text-subdued" mr="4px">
                  {intl.formatMessage({ id: 'form__inscription_value' })}
                </Text>
                <TipWithLabel
                  label={intl.formatMessage({
                    id: 'content__set_the_value_of_the_utxo_stored_in_this_inscription',
                  })}
                />
              </Box>
              <Text typography="Body1">{`${sat} sats`}</Text>
            </Box>
            <Slider
              py="4px"
              width="100%"
              minValue={546}
              maxValue={10000}
              accessibilityLabel="sat"
              step={1}
              value={sat}
              onChange={(value) => {
                setLoading(true);
                setSat(value);
              }}
              onChangeEnd={(value) => {
                setSat(value);
                refreshData(value);
              }}
            >
              <Slider.Track bg="surface-neutral-default" height="4px">
                <Slider.FilledTrack bg="interactive-default" height="4px" />
              </Slider.Track>
              <Slider.Thumb
                style={{ position: 'absolute' }}
                borderWidth={0}
                bg="transparent"
              >
                <Box
                  borderRadius="full"
                  borderColor="icon-default"
                  width="16px"
                  height="16px"
                  borderWidth="3px"
                  bg="surface-neutral-default"
                />
              </Slider.Thumb>
            </Slider>

            <Box mt="16px" flexDirection="row" justifyContent="space-between">
              <Text typography="Body1Strong" color="text-subdued">
                {intl.formatMessage({ id: 'form__inscription_owner' })}
              </Text>
              <Pressable
                flexDirection="row"
                alignItems="center"
                onPress={() => {
                  copyToClipboard(receiveAddress);
                  ToastManager.show({
                    title: intl.formatMessage({ id: 'msg__copied' }),
                  });
                }}
              >
                <Text typography="Body1" mr="8px">
                  {shortenAddress(receiveAddress, 6)}
                </Text>
                <Icon name="Square2StackOutline" size={20} />
              </Pressable>
            </Box>

            <Box mt="16px" flexDirection="row" justifyContent="space-between">
              <Text typography="Body1Strong" color="text-subdued">
                {intl.formatMessage({ id: 'form__inscription_file_size' })}
              </Text>
              <Text typography="Body1">{formatBytes(size)}</Text>
            </Box>
            <Box
              my="16px"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box flexDirection="row" alignItems="center">
                <Text typography="Body1Strong" color="text-subdued" mr="4px">
                  {intl.formatMessage({ id: 'form__inscribing_fee' })}
                </Text>
                <TipWithLabel
                  label={intl.formatMessage({
                    id: 'content__network_fee_for_inscription_genesis_tx',
                  })}
                />
              </Box>
              {loading ||
              order === undefined ||
              order.fundingValue === undefined ? (
                <Skeleton shape="Subheading" />
              ) : (
                <Text typography="Body1">{`${
                  order.fundingValue - sat
                } sats`}</Text>
              )}
            </Box>
          </ScrollView>
          {AvailableBalance}
          {/* {isVerticalLayout ? AvailableBalance : null} */}
        </VStack>
      )}
    </Modal>
  );
};

export default CreateOrder;
