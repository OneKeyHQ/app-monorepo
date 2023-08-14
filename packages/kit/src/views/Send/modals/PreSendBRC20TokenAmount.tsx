import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Icon,
  Modal,
  Pressable,
  Spinner,
  Text,
  ToastManager,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { TaprootAddressError } from '@onekeyhq/engine/src/errors';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  FormatBalance,
  FormatCurrencyTokenOfAccount,
} from '../../../components/Format';
import { GridList } from '../../../components/GridList';
import { SelectedIndicator } from '../../../components/SelectedIndicator';
import OrdinalsSVG from '../../../components/SVG/OrdinalsSVG';
import { useAccountSimple } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  InscribeModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { SendModalRoutes } from '../types';

import type { BRC20TokenAmountItem, SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItemInfo } from 'react-native';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.PreSendBRC20TokenAmount
>;

function AmountCard({
  cardWidth,
  data,
  token,
  style,
  onSelected,
  isSelected,
}: {
  cardWidth: number;
  data: BRC20TokenAmountItem;
  token: Token;
  style?: ComponentProps<typeof Box>;
  isSelected: boolean;
  onSelected: (amountId: string, isSelected: boolean) => void;
}) {
  return (
    <Box borderRadius="12px" overflow="hidden" {...style}>
      <Pressable
        width={cardWidth}
        flexDirection="column"
        onPress={() => onSelected(data.inscriptionId, isSelected)}
      >
        {({ isHovered, isPressed }) => (
          <>
            <MotiView
              animate={{ opacity: isHovered || isPressed ? 0.8 : 1 }}
              transition={{ type: 'timing', duration: 150 }}
            >
              <Box height="104px" bgColor="surface-default" padding={1}>
                <Center width="full" height="full">
                  <FormatBalance
                    balance={data.amount}
                    formatOptions={{
                      fixed: 6,
                    }}
                    render={(ele) => (
                      <Text
                        typography="Body2Strong"
                        textAlign="center"
                        numberOfLines={2}
                      >
                        {ele}
                      </Text>
                    )}
                  />
                  <Text
                    typography="CaptionMono"
                    textAlign="center"
                    color="text-subdued"
                  >
                    {token.symbol}
                  </Text>
                </Center>
              </Box>
              <HStack
                padding={1}
                bgColor="surface-selected"
                alignItems="center"
              >
                <OrdinalsSVG />
                <Text typography="CaptionMono" numberOfLines={1}>
                  #{data.inscriptionNumber}
                </Text>
              </HStack>
            </MotiView>
            <Box position="absolute" right="6px" top="6px">
              <SelectedIndicator multiSelect selected={isSelected} width={20} />
            </Box>
          </>
        )}
      </Pressable>
    </Box>
  );
}

function CreateAmountCard({
  onPress,
  style,
  cardWidth,
}: {
  cardWidth: number;
  onPress: () => void;
  style?: ComponentProps<typeof Box>;
}) {
  const intl = useIntl();

  return (
    <Box
      borderRadius="12px"
      overflow="hidden"
      borderWidth={1}
      borderColor="border-default"
      borderStyle="dashed"
      {...style}
    >
      <Pressable width={cardWidth - 2} flexDirection="column" onPress={onPress}>
        {({ isHovered, isPressed }) => (
          <MotiView
            animate={{ opacity: isHovered || isPressed ? 0.8 : 1 }}
            transition={{ type: 'timing', duration: 150 }}
          >
            <Box height="126px" bgColor="surface-default">
              <Center width="full" height="full">
                <Icon name="PlusSolid" size={24} />
                <Text typography="Button2" mt={2}>
                  {intl.formatMessage({ id: 'title__inscribe' })}
                </Text>
              </Center>
            </Box>
          </MotiView>
        )}
      </Pressable>
    </Box>
  );
}

function PreSendBRC20TokenAmount() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useAppNavigation();
  const modalClose = useModalClose();
  const [isLoadingAmountDetail, setIsLoadingAmountDetail] = useState(false);
  const [selectedAmounts, setSelectedAmounts] = useState<string[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [amountList, setAmountList] = useState<BRC20TokenAmountItem[]>([]);

  const { accountId, networkId, token } = route.params ?? {};

  const account = useAccountSimple(accountId);

  const handleAmountSelected = useCallback(
    (amountId: string, isSelected: boolean) => {
      if (isSelected) {
        setSelectedAmounts((prev) => prev.filter((id) => id !== amountId));
      } else {
        setSelectedAmounts((prev) => [...prev, amountId]);
      }
    },
    [],
  );

  const validateAddress = useCallback(
    async (address: string) => {
      try {
        await backgroundApiProxy.serviceInscribe.checkValidTaprootAddress({
          address,
          networkId,
          accountId,
        });
      } catch (error) {
        throw new TaprootAddressError();
      }
    },
    [accountId, networkId],
  );

  const handleCreateAmount = useCallback(() => {
    if (accountId && networkId && token) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Inscribe,
        params: {
          screen: InscribeModalRoutes.BRC20Amount,
          params: {
            networkId,
            accountId,
            token,
          },
        },
      });
    }
  }, [accountId, navigation, networkId, token]);

  const handleNextOnPress = useCallback(async () => {
    if (!accountId || !networkId) return;
    setIsLoadingAmountDetail(true);
    const amountDetails = (
      await Promise.all(
        selectedAmounts.map((inscriptionId) =>
          backgroundApiProxy.serviceNFT.getAsset({
            accountId,
            networkId,
            tokenId: inscriptionId,
            local: true,
          }),
        ),
      )
    ).filter((item) => item) as NFTBTCAssetModel[];

    if (amountDetails.length !== selectedAmounts.length) {
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: 'msg__nft_does_not_exist',
          }),
        },
        { type: 'error' },
      );
      setIsLoadingAmountDetail(false);
      return;
    }

    const transferInfos: ITransferInfo[] = amountDetails.map(
      (amountDetail) => ({
        isNFT: true,
        isBRC20: true,
        from: '',
        to: '',
        amount: '0',
        nftTokenId: amountDetail.inscription_id,
        token: token?.tokenIdOnNetwork || token?.address,
        nftInscription: {
          address: amountDetail.owner,
          inscriptionId: amountDetail.inscription_id,
          output: amountDetail.output,
          location: amountDetail.location,
        },
      }),
    );

    setIsLoadingAmountDetail(false);

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.PreSendAddress,
        params: {
          accountId,
          networkId,
          from: '',
          to: '',
          amount: '0',
          transferInfos,
          validateAddress: async (_, address) => {
            await validateAddress(address);
          },

          closeModal: modalClose,
        },
      },
    });
  }, [
    accountId,
    intl,
    modalClose,
    navigation,
    networkId,
    selectedAmounts,
    token?.address,
    token?.tokenIdOnNetwork,
    validateAddress,
  ]);

  const TokenAmountFooter = useMemo(() => {
    const selectedTotalAmount = selectedAmounts.reduce((prev, current) => {
      const amount = amountList.find((item) => item.inscriptionId === current);
      return new BigNumber(prev).plus(amount?.amount ?? 0).toFixed();
    }, '0');

    return (
      <Box padding={4}>
        <HStack mb={4}>
          <Text typography="Body1Strong" flex={1}>
            {intl.formatMessage(
              { id: 'form__str_selected' },
              { 0: selectedAmounts.length },
            )}
          </Text>
          <VStack flex={1}>
            <FormatBalance
              balance={selectedTotalAmount}
              suffix={token.symbol}
              formatOptions={{
                fixed: 6,
              }}
              render={(ele) => (
                <Text
                  typography="Body1Strong"
                  textAlign="right"
                  numberOfLines={2}
                >
                  {ele}
                </Text>
              )}
            />
            <FormatCurrencyTokenOfAccount
              networkId={networkId}
              accountId={accountId}
              value={selectedTotalAmount}
              token={token}
              render={(ele) => (
                <Text color="text-subdued" textAlign="right">
                  {ele}
                </Text>
              )}
            />
          </VStack>
        </HStack>
        <Button
          type="primary"
          size="lg"
          isLoading={isLoadingAmountDetail}
          isDisabled={selectedAmounts.length === 0}
          onPress={handleNextOnPress}
        >
          {intl.formatMessage({ id: 'action__next' })}
        </Button>
      </Box>
    );
  }, [
    accountId,
    amountList,
    handleNextOnPress,
    intl,
    isLoadingAmountDetail,
    networkId,
    selectedAmounts,
    token,
  ]);

  const renderItem = useCallback(
    ({
      item,
      cardWidth,
    }: ListRenderItemInfo<BRC20TokenAmountItem> & { cardWidth: number }) => {
      if (
        item.amount === '0' &&
        item.inscriptionId === '0' &&
        item.inscriptionNumber === '0'
      )
        return (
          <CreateAmountCard
            onPress={handleCreateAmount}
            cardWidth={cardWidth}
            style={{ mr: 2, mb: 4 }}
          />
        );
      return (
        <AmountCard
          cardWidth={cardWidth}
          data={item}
          token={token}
          style={{ mr: 2, mb: 4 }}
          isSelected={selectedAmounts.includes(item.inscriptionId)}
          onSelected={handleAmountSelected}
        />
      );
    },
    [handleAmountSelected, handleCreateAmount, selectedAmounts, token],
  );

  const AmountListFooter = useMemo(() => {
    const selectedTotalAmount = amountList.reduce(
      (prev, current) =>
        new BigNumber(prev).plus(current?.amount ?? 0).toFixed(),
      '0',
    );

    return (
      <>
        <Divider mt={2} mb={4} />
        <HStack alignItems="center">
          <Text typography="Subheading" flex={1}>
            {intl.formatMessage(
              { id: 'form__str_items__uppercase' },
              { 0: amountList.length },
            )}
          </Text>
          <FormatBalance
            balance={selectedTotalAmount}
            suffix={token.symbol}
            formatOptions={{
              fixed: 6,
            }}
            render={(ele) => (
              <Text
                flex={1}
                typography="Subheading"
                textAlign="right"
                textTransform="uppercase"
              >
                {ele}
              </Text>
            )}
          />
        </HStack>
      </>
    );
  }, [amountList, intl, token.symbol]);

  const renderContent = useCallback(() => {
    if (isLoadingList) {
      return (
        <Center width="full" height="full">
          <Spinner />
        </Center>
      );
    }

    const renderList = [
      ...amountList,
      {
        amount: '0',
        inscriptionId: '0',
        inscriptionNumber: '0',
      },
    ];

    return (
      <GridList
        data={renderList}
        renderItem={renderItem}
        refreshing={isLoadingList}
        ListFooterComponent={AmountListFooter}
      />
    );
  }, [AmountListFooter, amountList, isLoadingList, renderItem]);

  const fetchAmountList = useCallback(async () => {
    if (account && networkId && token) {
      setIsLoadingList(true);
      const resp = await backgroundApiProxy.serviceBRC20.getBRC20AmountList({
        networkId,
        address: account.address,
        xpub: account.xpub ?? '',
        tokenAddress: token.tokenIdOnNetwork ?? token.address,
      });
      setAmountList(resp.transferBalanceList);
      setIsLoadingList(false);
    }
  }, [account, networkId, token]);

  useEffect(() => {
    fetchAmountList();
  }, [fetchAmountList]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__amount' })}
      height="584px"
      headerDescription={
        <Text typography="Caption" color="text-subdued">{`${
          token?.name ?? ''
        } (brc20)`}</Text>
      }
      footer={TokenAmountFooter}
    >
      {renderContent()}
    </Modal>
  );
}

export { PreSendBRC20TokenAmount };
