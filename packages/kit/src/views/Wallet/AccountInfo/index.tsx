import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Skeleton,
  Text,
  ToastManager,
  Tooltip,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
} from '@onekeyhq/kit/src/hooks/redux';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/types';
import {
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import type { SendRoutesParams } from '@onekeyhq/kit/src/views/Send/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_LIGHTNING } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountValues, useNavigationActions } from '../../../hooks';
import { useCopyAddress } from '../../../hooks/useCopyAddress';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { calculateGains } from '../../../utils/priceUtils';
import AccountMoreMenu from '../../Overlay/AccountMoreMenu';
import { showAccountValueSettings } from '../../Overlay/AccountValueSettings';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams> &
  ModalScreenProps<SendRoutesParams>;

export const FIXED_VERTICAL_HEADER_HEIGHT = 238;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 152;

const AccountAmountInfo: FC = () => {
  const intl = useIntl();

  const { account, wallet, networkId, accountId, network } =
    useActiveWalletAccount();

  const { copyAddress } = useCopyAddress({ wallet });

  const accountAllValues = useAccountValues({
    networkId,
    accountId,
  });

  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);

  const displayAddress = useMemo(
    () => !network?.settings.hiddenAddress,
    [network?.settings.hiddenAddress],
  );

  const summedValueComp = useMemo(
    () =>
      accountAllValues.value.isNaN() ? (
        <Skeleton shape="DisplayXLarge" />
      ) : (
        <HStack flex="1" alignItems="center">
          <Typography.Display2XLarge numberOfLines={2} isTruncated>
            <FormatCurrencyNumber decimals={2} value={accountAllValues.value} />
          </Typography.Display2XLarge>
          <IconButton
            name="ChevronDownMini"
            onPress={showAccountValueSettings}
            type="plain"
            circle
            ml={1}
          />
        </HStack>
      ),
    [accountAllValues],
  );

  const changedValueComp = useMemo(() => {
    const { gainNumber, percentageGain, gainTextColor } = calculateGains({
      basePrice: accountAllValues.value24h.toNumber(),
      price: accountAllValues.value.toNumber(),
    });

    return accountAllValues.value.isNaN() ? (
      <Skeleton shape="Body1" />
    ) : (
      <>
        <Typography.Body1Strong color={gainTextColor} mr="4px">
          {percentageGain}
        </Typography.Body1Strong>
        <Typography.Body1Strong color="text-subdued">
          (<FormatCurrencyNumber value={Math.abs(gainNumber)} decimals={2} />)
          {` ${intl.formatMessage({ id: 'content__today' })}`}
        </Typography.Body1Strong>
      </>
    );
  }, [intl, accountAllValues]);

  return (
    <Box alignItems="flex-start" flex="1">
      <Box mx="-8px" my="-4px" flexDir="row" alignItems="center">
        {displayAddress ? (
          <Tooltip
            hasArrow
            placement="top"
            label={intl.formatMessage({ id: 'action__copy_address' })}
          >
            <Pressable
              flexDirection="row"
              alignItems="center"
              py="4px"
              px="8px"
              rounded="12px"
              _hover={{ bg: 'surface-hovered' }}
              _pressed={{ bg: 'surface-pressed' }}
              onPress={() => {
                copyAddress({
                  address: account?.address,
                  displayAddress: account?.displayAddress,
                });
              }}
            >
              <Text
                typography={{ sm: 'Body2', md: 'CaptionStrong' }}
                mr={2}
                color="text-subdued"
              >
                {shortenAddress(
                  account?.displayAddress ?? account?.address ?? '',
                )}
              </Text>
              <Icon name="Square2StackOutline" color="icon-subdued" size={16} />
            </Pressable>
          </Tooltip>
        ) : null}
        {hasAvailable ? (
          <Tooltip
            hasArrow
            placement="top"
            label={intl.formatMessage({ id: 'form__blockchain_browser' })}
          >
            <Pressable
              p={1}
              rounded="full"
              _hover={{ bg: 'surface-hovered' }}
              _pressed={{ bg: 'surface-pressed' }}
              onPress={() => openAddressDetails(account?.address)}
            >
              <Icon name="GlobeAltOutline" color="icon-subdued" size={16} />
            </Pressable>
          </Tooltip>
        ) : null}
      </Box>
      <Box flexDirection="row" alignItems="center" mt={1} w="full">
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
  const { wallet, account, network } = useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();
  const { sendToken } = useNavigationActions();
  const iconBoxFlex = isVertical ? 1 : 0;

  const onSendToken = useCallback(() => {
    const { accountId, networkId } = getActiveWalletAccount();
    sendToken({ accountId, networkId });
  }, [sendToken]);

  const onReceive = useCallback(() => {
    if (network?.impl === IMPL_LIGHTNING) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Receive,
        params: {
          screen: ReceiveTokenModalRoutes.CreateInvoice,
          params: {
            networkId: network.id,
            accountId: account?.id,
          },
        },
      });
      return;
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Receive,
      params: {
        screen: ReceiveTokenModalRoutes.ReceiveToken,
        params: {},
      },
    });
  }, [navigation, account, network]);

  const onSwap = useCallback(async () => {
    let token = await backgroundApiProxy.engine.getNativeTokenInfo(
      network?.id ?? '',
    );
    if (token) {
      const supported = await backgroundApiProxy.serviceSwap.tokenIsSupported(
        token,
      );
      if (!supported) {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'msg__wrong_network_desc' }),
          },
          { type: 'default' },
        );
        token = await backgroundApiProxy.engine.getNativeTokenInfo(
          OnekeyNetwork.eth,
        );
      }
      backgroundApiProxy.serviceSwap.sellToken(token);
      if (account) {
        backgroundApiProxy.serviceSwap.setSendingAccountSimple(account);
        const paymentToken =
          await backgroundApiProxy.serviceSwap.getPaymentToken(token);
        if (paymentToken?.networkId === network?.id) {
          backgroundApiProxy.serviceSwap.setRecipientToAccount(
            account,
            network,
          );
        }
      }
    }
    navigation.getParent()?.navigate(TabRoutes.Swap);
  }, [network, account, navigation, intl]);

  return (
    <Box flexDirection="row" px={isVertical ? 1 : 0} mx={-3}>
      <Pressable
        flex={iconBoxFlex}
        mx={3}
        minW="56px"
        alignItems="center"
        isDisabled={wallet?.type === 'watching' || !account}
        onPress={onSendToken}
      >
        <TouchableWithoutFeedback>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="PaperAirplaneOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching' || !account}
            onPress={onSendToken}
          />
        </TouchableWithoutFeedback>
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
      </Pressable>
      <Pressable
        flex={iconBoxFlex}
        mx={3}
        minW="56px"
        alignItems="center"
        isDisabled={wallet?.type === 'watching' || !account}
        onPress={onReceive}
      >
        <TouchableWithoutFeedback>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="QrCodeOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching' || !account}
            onPress={onReceive}
          />
        </TouchableWithoutFeedback>
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
      </Pressable>
      {network?.settings.hiddenAccountInfoSwapOption ? null : (
        <Pressable
          flex={iconBoxFlex}
          mx={3}
          minW="56px"
          alignItems="center"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={onSwap}
        >
          <TouchableWithoutFeedback>
            <IconButton
              circle
              size={isSmallView ? 'xl' : 'lg'}
              name="ArrowsRightLeftOutline"
              type="basic"
              isDisabled={wallet?.type === 'watching' || !account}
              onPress={onSwap}
            />
          </TouchableWithoutFeedback>
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
        </Pressable>
      )}

      {network?.settings.hiddenAccountInfoMoreOption ? null : (
        <Box flex={iconBoxFlex} mx={3} minW="56px" alignItems="center">
          <AccountMoreMenu>
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
      )}
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
      <DesktopDragZoneAbsoluteBar />
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
        <AccountOption isSmallView={isSmallView} />
      </Box>
    </>
  );
};

export default AccountInfo;
