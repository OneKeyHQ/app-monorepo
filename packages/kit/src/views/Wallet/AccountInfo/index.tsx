import type { FC } from 'react';
import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Skeleton,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import {
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/types';
import type { SendRoutesParams } from '@onekeyhq/kit/src/views/Send/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';
import { useCopyAddress } from '../../../hooks/useCopyAddress';
import { useManageTokenprices } from '../../../hooks/useManegeTokenPrice';
import { useNFTPrice } from '../../../hooks/useTokens';
import { SWAP_TAB_NAME } from '../../../store/reducers/market';
import { getTimeDurationMs } from '../../../utils/helper';
import {
  calculateGains,
  getPreBaseValue,
  getSummedValues,
} from '../../../utils/priceUtils';
import AccountMoreMenu from '../../Overlay/AccountMoreMenu';
import { showAccountValueSettings } from '../../Overlay/AccountValueSettings';

import type { SimpleTokenPrices } from '../../../store/reducers/tokens';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams> &
  ModalScreenProps<SendRoutesParams>;

export const FIXED_VERTICAL_HEADER_HEIGHT = 238;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 152;

const AccountAmountInfo: FC = () => {
  const intl = useIntl();

  const { hideSmallBalance, includeNFTsInTotal = true } = useAppSelector(
    (s) => s.settings,
  );

  const { account, wallet, network, networkId, accountId } =
    useActiveWalletAccount();
  const nftPrice = useNFTPrice({
    accountId: account?.address,
    networkId: network?.id,
  });

  const { accountTokens, balances } = useManageTokens({
    pollingInterval: 15000,
  });

  const { prices } = useManageTokenprices({
    networkId,
    accountId,
    pollingInterval: getTimeDurationMs({ minute: 5 }),
  });

  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);

  const { copyAddress } = useCopyAddress({ wallet });

  const [summedValue, summedValueComp] = useMemo(() => {
    const displayValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices,
      vsCurrency,
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
              value={displayValue}
              convertValue={includeNFTsInTotal ? nftPrice : null}
            />
          </Typography.Display2XLarge>
          <IconButton
            name="ChevronDownMini"
            onPress={showAccountValueSettings}
            type="plain"
            circle
            ml={1}
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
    vsCurrency,
  ]);

  const changedValueComp = useMemo(() => {
    const basePrices: Record<string, SimpleTokenPrices> = {};
    accountTokens.forEach((token) => {
      const tokenId = token?.tokenIdOnNetwork || 'main';
      const priceId = token?.tokenIdOnNetwork
        ? `${token?.networkId}-${token.tokenIdOnNetwork}`
        : token?.networkId ?? '';
      const balance = balances[tokenId];
      const priceInfo = prices?.[priceId];
      if (typeof balance !== 'undefined') {
        basePrices[priceId] = getPreBaseValue({
          priceInfo,
          vsCurrency,
        });
      }
    });
    const displayBaseValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices: basePrices,
      vsCurrency,
      hideSmallBalance,
    }).toNumber();
    const { gain, percentageGain, gainTextColor } = calculateGains({
      basePrice: displayBaseValue,
      price: summedValue,
    });

    return Number.isNaN(summedValue) ? (
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
  }, [
    accountTokens,
    balances,
    hideSmallBalance,
    intl,
    prices,
    summedValue,
    vsCurrency,
  ]);

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
          <Icon name="Square2StackOutline" color="icon-subdued" size={16} />
        </Pressable>
      </Box>
      <Box flexDirection="row" alignItems="center" mt={1}>
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
  const isVertical = useIsVerticalLayout();
  const { sendToken } = useNavigationActions();

  return (
    <Box flexDirection="row" px={{ base: 1, md: 0 }} mx={-3}>
      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="PaperAirplaneOutline"
          type="basic"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => {
            const { accountId, networkId } = getActiveWalletAccount();
            sendToken({ accountId, networkId });
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
          name="QrCodeOutline"
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
          name="ArrowsRightLeftOutline"
          type="basic"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => {
            if (isVertical) {
              backgroundApiProxy.serviceMarket.switchMarketTopTab(
                SWAP_TAB_NAME,
              );
              navigation.getParent()?.navigate(TabRoutes.Market);
            } else {
              navigation.getParent()?.navigate(TabRoutes.Swap);
            }
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

      <Box flex={{ base: 1, sm: 0 }} mx={3} minW="56px" alignItems="center">
        <AccountMoreMenu offset={30} placement="bottom right">
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="EllipsisVerticalOutline"
            type="basic"
          />
        </AccountMoreMenu>
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
