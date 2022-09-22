/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  IconButton,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import Skeleton from '@onekeyhq/components/src/Skeleton';
import { Text } from '@onekeyhq/components/src/Typography';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
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

import { useCopyAddress } from '../../../hooks/useCopyAddress';
import { useNFTPrice } from '../../../hooks/useTokens';
import { calculateGains, getSummedValues } from '../../../utils/priceUtils';
import { showAccountMoreMenu } from '../../Overlay/AccountMoreMenu';
import { showAccountValueSettings } from '../../Overlay/BottomSheetSettings';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams> &
  ModalScreenProps<SendRoutesParams>;

export const FIXED_VERTICAL_HEADER_HEIGHT = 238;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 216;

const AccountAmountInfo: FC = () => {
  const intl = useIntl();

  const { hideSmallBalance, includeNFTsInTotal = true } = useAppSelector(
    (s) => s.settings,
  );

  const { account, wallet, network } = useActiveWalletAccount();
  const nftPrice = useNFTPrice({
    accountId: account?.address,
    networkId: network?.id,
  });
  const { accountTokens, prices, balances, charts } = useManageTokens({
    pollingInterval: 15000,
  });

  const { copyAddress } = useCopyAddress({ wallet });

  const [summedValue, summedValueComp] = useMemo(() => {
    const displayValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices,
      hideSmallBalance,
    }).toNumber();

    return [
      displayValue,
      Number.isNaN(displayValue) ? (
        <Skeleton shape="DisplayXLarge" />
      ) : (
        <>
          <Typography.Display2XLarge>
            <FormatCurrencyNumber
              decimals={2}
              value={
                includeNFTsInTotal ? displayValue + nftPrice : displayValue
              }
            />
          </Typography.Display2XLarge>
          <Button
            type="plain"
            alignItems="center"
            justifyContent="center"
            onPress={showAccountValueSettings}
            leftIconName="ChevronDownSolid"
          />
        </>
      ),
    ];
  }, [
    accountTokens,
    balances,
    hideSmallBalance,
    includeNFTsInTotal,
    nftPrice,
    prices,
  ]);

  const changedValueComp = useMemo(() => {
    const basePrices: Record<string, number> = {};
    accountTokens.forEach((token) => {
      const tokenId = token.tokenIdOnNetwork || 'main';
      const balance = balances[tokenId];
      if (typeof balance !== 'undefined') {
        basePrices[tokenId] = charts[tokenId]?.[0][1] ?? 0;
      }
    });
    const displayBaseValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices: basePrices,
      hideSmallBalance,
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
  }, [accountTokens, balances, charts, hideSmallBalance, intl, summedValue]);

  return (
    <Box alignItems="flex-start">
      <Box mx="-8px" my="-4px">
        <Pressable
          flexDirection="row"
          alignItems="center"
          py="4px"
          px="8px"
          rounded="12px"
          _hover={{ bg: 'surface-hovered' }}
          _pressed={{ bg: 'surface-pressed' }}
          onPress={() => {
            copyAddress(account?.displayAddress ?? account?.address);
          }}
        >
          <Text
            typography={{ sm: 'Body2', md: 'CaptionStrong' }}
            mr={2}
            color="text-subdued"
          >
            {shortenAddress(account?.displayAddress ?? account?.address ?? '')}
          </Text>
          <Icon name="DuplicateOutline" size={16} />
        </Pressable>
      </Box>
      <Box flexDirection="row" mt={1}>
        {summedValueComp}
      </Box>
      <Box flexDirection="row" mt={1}>
        {changedValueComp}
      </Box>
    </Box>
  );
};

type AccountOptionProps = { isSmallView: boolean };

const AccountOption: FC<AccountOptionProps> = ({ isSmallView }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { wallet, account } = useActiveWalletAccount();
  const moreButtonRef = useRef();

  return (
    <Box flexDirection="row" px={{ base: 1, md: 0 }} mx={-3}>
      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="ArrowUpOutline"
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
          name="ArrowDownOutline"
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
          name="SwitchHorizontalOutline"
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

      <Box
        ref={moreButtonRef}
        flex={{ base: 1, sm: 0 }}
        mx={3}
        minW="56px"
        alignItems="center"
      >
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="DotsVerticalOutline"
          type="basic"
          onPress={() => showAccountMoreMenu(moreButtonRef.current)}
        />
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color="text-default"
        >
          {intl.formatMessage({ id: 'action__more' })}
        </Typography.CaptionStrong>
      </Box>
    </Box>
  );
};

const AccountInfo = () => {
  const isSmallView = useIsVerticalLayout();
  if (isSmallView) {
    return (
      <Box
        pt="16px"
        pb="24px"
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
        py={8}
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
