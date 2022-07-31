/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Typography,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import Skeleton from '@onekeyhq/components/src/Skeleton';
import { Text } from '@onekeyhq/components/src/Typography';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { FiatPayRoutes } from '@onekeyhq/kit/src/routes/Modal/FiatPay';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/types';
import {
  SendRoutes,
  SendRoutesParams,
} from '@onekeyhq/kit/src/views/Send/types';

import { calculateGains, getSummedValues } from '../../../utils/priceUtils';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams> &
  ModalScreenProps<SendRoutesParams>;

export const FIXED_VERTICAL_HEADER_HEIGHT = 298;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 214;

const AccountAmountInfo: FC = () => {
  const intl = useIntl();
  const toast = useToast();

  const navigation = useNavigation<NavigationProps['navigation']>();

  const { account, wallet } = useActiveWalletAccount();

  const { accountTokens, prices, balances, charts } = useManageTokens({
    pollingInterval: 15000,
  });

  const isHwWallet = wallet?.type === 'hw';

  const copyContentToClipboard = useCallback(
    (address) => {
      if (!address) return;
      copyToClipboard(address);
      toast.show({ title: intl.formatMessage({ id: 'msg__address_copied' }) });
    },
    [toast, intl],
  );

  const [summedValue, summedValueComp] = useMemo(() => {
    const displayValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices,
    }).toNumber();

    return [
      displayValue,
      Number.isNaN(displayValue) ? (
        <Skeleton shape="DisplayXLarge" />
      ) : (
        <Typography.Display2XLarge>
          <FormatCurrencyNumber value={displayValue} />
        </Typography.Display2XLarge>
      ),
    ];
  }, [accountTokens, balances, prices]);

  const changedValueComp = useMemo(() => {
    const basePrices: Record<string, number> = {};
    accountTokens.forEach((token) => {
      const tokenId = token.tokenIdOnNetwork || 'main';
      const balance = balances[tokenId];
      if (typeof balance !== 'undefined') {
        basePrices[tokenId] = charts[tokenId][0][1] ?? 0;
      }
    });
    const displayBaseValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices: basePrices,
    }).toNumber();

    const { gain, percentageGain, gainTextColor } = calculateGains({
      basePrice: displayBaseValue,
      price: summedValue,
    });

    return Number.isNaN(displayBaseValue) ? (
      <Skeleton shape="Body1" />
    ) : (
      <>
        <Typography.Body1Strong color={gainTextColor} mr="4px">
          {percentageGain}
        </Typography.Body1Strong>
        <Typography.Body1Strong color="text-subdued">
          (<FormatCurrencyNumber onlyNumber value={gain} decimals={2} />){' '}
          {intl.formatMessage({ id: 'content__today' })}
        </Typography.Body1Strong>
      </>
    );
  }, [accountTokens, balances, charts, intl, summedValue]);

  return (
    <Box alignItems="flex-start">
      <Pressable
        mt={4}
        flexDirection="row"
        alignItems="center"
        onPress={() => {
          if (isHwWallet) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenRoutes.ReceiveToken,
                params: {},
              },
            });
          } else {
            copyContentToClipboard(account?.address);
          }
        }}
      >
        <Text
          typography={{ sm: 'Body2', md: 'CaptionStrong' }}
          mr={2}
          color="text-subdued"
        >
          {isHwWallet
            ? intl.formatMessage({ id: 'action__copy_address' })
            : shortenAddress(account?.address ?? '')}
        </Text>
        <Icon name="DuplicateOutline" size={16} />
      </Pressable>
      <Box flexDirection="row" mt={2}>
        {summedValueComp}
      </Box>
      <Box flexDirection="row" mt={4}>
        {changedValueComp}
      </Box>
    </Box>
  );
};

type AccountOptionProps = { isSmallView: boolean };

const AccountOption: FC<AccountOptionProps> = ({ isSmallView }) => {
  const { network: activeNetwork } = useActiveWalletAccount();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { wallet, account } = useActiveWalletAccount();

  return (
    <Box flexDirection="row" px={{ base: 1, md: 0 }} mx={-3}>
      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="ArrowUpSolid"
          type="basic"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.PreSendToken,
                params: {
                  from: '',
                  to: '',
                  amount: '',
                },
              },
            });
          }}
        />
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Typography.CaptionStrong>
      </Box>
      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="ArrowDownSolid"
          type="basic"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenRoutes.ReceiveToken,
                params: {},
              },
            });
          }}
        />
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Typography.CaptionStrong>
      </Box>
      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="SwitchHorizontalSolid"
          type="basic"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => {
            navigation.getParent()?.navigate(TabRoutes.Swap);
          }}
        />
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.CaptionStrong>
      </Box>

      {wallet?.type !== 'watching' && account && (
        <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="NavBuySolid"
            type="basic"
            onPress={() => {
              if (!account) return;
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.FiatPay,
                params: {
                  screen: FiatPayRoutes.SupportTokenListModal,
                  params: {
                    networkId: activeNetwork?.id ?? '',
                  },
                },
              });
            }}
          />
          <Typography.CaptionStrong
            textAlign="center"
            mt="8px"
            color="text-default"
          >
            {intl.formatMessage({ id: 'action__buy' })}
          </Typography.CaptionStrong>
        </Box>
      )}
    </Box>
  );
};

const AccountInfo = () => {
  const isSmallView = useIsVerticalLayout();
  if (isSmallView) {
    return (
      <Box
        py="24px"
        w="100%"
        px="16px"
        flexDirection="column"
        bgColor="background-default"
        h={FIXED_VERTICAL_HEADER_HEIGHT}
      >
        <AccountAmountInfo />
        <Box mt={8}>
          <AccountOption isSmallView={isSmallView} />
        </Box>
      </Box>
    );
  }
  return (
    <>
      <DesktopDragZoneAbsoluteBar h={8} />
      <Box
        h={FIXED_HORIZONTAL_HEDER_HEIGHT}
        py={12}
        px={{ sm: 8, lg: 4 }}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        bgColor="background-default"
      >
        <AccountAmountInfo />
        <Box>
          <AccountOption isSmallView={isSmallView} />
        </Box>
      </Box>
    </>
  );
};

export default AccountInfo;
