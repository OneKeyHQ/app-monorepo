import {
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Keyboard,
  Pressable,
  RichTooltip,
  Spinner,
  Text,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatBalanceTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import {
  useTokenBalance,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks/useOverview';
import { useFrozenBalance, useSingleToken } from '../../../hooks/useTokens';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';
import {
  showAccountBalanceDetailsOverlay,
  useAccountBalanceDetailsInfo,
} from '../../Overlay/AccountBalanceDetailsPanel';
import BalanceTypeMenu from '../components/BalanceTypeMenu';
import { BaseSendModal } from '../components/BaseSendModal';
import { PreSendAmountAlert } from '../components/PreSendAmountAlert';
import { SendModalRoutes } from '../enums';
import { usePreSendAmountInfo } from '../utils/usePreSendAmountInfo';
import { useReloadAccountBalance } from '../utils/useReloadAccountBalance';

import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MessageDescriptor } from 'react-intl';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.PreSendAmount
>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendAmount>;

export function PreSendAmountPreview({
  title,
  titleAction,
  text,
  onChangeText,
  loading,
  desc,
  placeholder = '0',
}: {
  text: string;
  onChangeText?: (text: string) => void;
  title?: string;
  titleAction?: JSX.Element;
  desc?: string | JSX.Element;
  loading?: boolean;
  placeholder?: string;
}) {
  const intl = useIntl();
  const [isVisible, setIsVisible] = useState(false);
  const onPaste = useCallback(async () => {
    const pastedText = await getClipboard();
    onChangeText?.(pastedText);
    setIsVisible(false);
  }, [onChangeText]);

  const descView = useMemo(() => {
    if (!desc) {
      return null;
    }
    if (isValidElement(desc)) {
      return <Center>{desc}</Center>;
    }
    return (
      <Text
        numberOfLines={2}
        typography="Body1Strong"
        textAlign="center"
        isTruncated
      >
        {desc}
      </Text>
    );
  }, [desc]);

  const TextView = useMemo(
    () => (
      <AutoSizeText
        autoFocus
        text={text}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    ),
    [onChangeText, placeholder, text],
  );
  return (
    <Box height="140px">
      {!!title && (
        <HStack space={2} alignItems="center" justifyContent="center">
          <Box opacity={0}>{titleAction}</Box>
          <Text
            textAlign="center"
            typography="DisplayLarge"
            color="text-subdued"
          >
            {title}
          </Text>
          {titleAction}
        </HStack>
      )}
      <Center flex={1} maxH="64px" mt={2} mb={3}>
        {platformEnv.isNative ? (
          <RichTooltip
            // eslint-disable-next-line
            trigger={({ ...props }) => (
              <Pressable {...props}>{TextView}</Pressable>
            )}
            bodyProps={{
              children: (
                <Pressable onPress={onPaste}>
                  <Text typography="Body2" fontSize={15}>
                    {intl.formatMessage({ id: 'action__paste' })}
                  </Text>
                </Pressable>
              ),
            }}
            visible={isVisible}
            onToggle={setIsVisible}
          />
        ) : (
          TextView
        )}
      </Center>

      {loading ? <Spinner size="sm" /> : descView}
    </Box>
  );
}

function PreSendAmount() {
  const intl = useIntl();

  const { height } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const [isLoading, setIsLoading] = useState(false);
  const shortScreen = height < 768;
  // const space = shortScreen ? '16px' : '24px';
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);
  const [amount, setAmount] = useState('');
  const { account, accountId, networkId, network } =
    useActiveSideAccount(transferInfo);
  const { engine } = backgroundApiProxy;
  const [useCustomAddressesBalance, setuseCustomAddressesBalance] =
    useState(false);
  useReloadAccountBalance({
    networkId,
    accountId,
  });

  const tokenIdOnNetwork = transferInfo.token;
  const { token: tokenInfo } = useSingleToken(
    networkId,
    tokenIdOnNetwork ?? '',
  );

  const tokenBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: {
      ...tokenInfo,
      sendAddress: transferInfo.tokenSendAddress,
    },
    useRecycleBalance: tokenInfo?.isNative ?? true,
    fallback: '0',
    useCustomAddressesBalance,
  });

  const frozenBalance = useFrozenBalance({
    networkId,
    accountId,
    tokenId: tokenInfo?.tokenIdOnNetwork || 'main',
    useRecycleBalance: tokenInfo?.isNative ?? true,
    useCustomAddressesBalance,
  });

  const originalTokenBalance = useTokenBalance({
    networkId,
    accountId,
    token: {
      ...tokenInfo,
      sendAddress: transferInfo.tokenSendAddress,
    },
    useRecycleBalance: tokenInfo?.isNative ?? true,
    fallback: '0',
  });

  const getAmountValidateError = useCallback(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const inputBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    if (inputBN.isNaN() || balanceBN.isNaN()) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    if (balanceBN.isLessThan(inputBN)) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    return undefined;
  }, [amount, intl, tokenBalance, tokenInfo]);
  const errorMsg = getAmountValidateError();

  const minAmountBN = useMemo(
    () => new BigNumber(network?.settings.minTransferAmount || '0'),
    [network],
  );

  const [minAmountValidationPassed, minAmountNoticeNeeded] = useMemo(() => {
    const minAmountRequired = !minAmountBN.isNaN() && minAmountBN.gt('0');

    if (minAmountRequired) {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        return [false, false];
      }
      if (amountBN.lt(minAmountBN)) {
        return [false, amountBN.gt('0')];
      }
    }
    return [true, false];
  }, [minAmountBN, amount]);

  const hiddenAmountError = isLightningNetworkByNetworkId(networkId);
  const [invalidAmountError, setInvalidAmountError] = useState<{
    key: MessageDescriptor['id'];
    info: any;
  } | null>(null);
  const validateAmount = useCallback(async () => {
    if (!minAmountValidationPassed) {
      return {
        result: true,
        errorInfo: null,
      };
    }
    try {
      await engine.validateSendAmount({
        accountId,
        networkId,
        amount,
        tokenBalance: originalTokenBalance,
        to: transferInfo.to,
      });
      return { result: true, errorInfo: null };
    } catch (error: any) {
      const { key, info } = error;
      return {
        result: false,
        errorInfo: { key: key as MessageDescriptor['id'], info },
      };
    }
  }, [
    accountId,
    networkId,
    amount,
    engine,
    transferInfo,
    originalTokenBalance,
    minAmountValidationPassed,
  ]);
  useEffect(() => {
    const validFunc = async () => {
      const { result, errorInfo } = await validateAmount();
      setInvalidAmountError(result ? null : errorInfo);
    };
    validFunc();
  }, [validateAmount]);

  const desc = useMemo(
    () =>
      // eslint-disable-next-line no-nested-ternary
      minAmountNoticeNeeded ? (
        <Typography.Body1Strong color="text-critical">
          {intl.formatMessage(
            { id: 'form__str_minimum_transfer' },
            { 0: minAmountBN.toFixed(), 1: tokenInfo?.symbol },
          )}
        </Typography.Body1Strong>
      ) : invalidAmountError && !hiddenAmountError ? (
        <Typography.Body1Strong color="text-critical">
          {intl.formatMessage(
            { id: invalidAmountError.key },
            { ...invalidAmountError.info },
          )}
        </Typography.Body1Strong>
      ) : undefined,
    [
      intl,
      minAmountBN,
      minAmountNoticeNeeded,
      tokenInfo?.symbol,
      invalidAmountError,
      hiddenAmountError,
    ],
  );

  const shouldShowFrozenBalance = useMemo(() => {
    if (network?.settings.isBtcForkChain || network?.id === OnekeyNetwork.sol) {
      return false;
    }
    return new BigNumber(frozenBalance ?? '0').isGreaterThan(0);
  }, [frozenBalance, network?.id, network?.settings.isBtcForkChain]);

  const {
    title,
    titleAction,
    descView,
    text,
    onTextChange,
    validAmountRegex,
    setTextByAmount,
    isFiatMode,
  } = usePreSendAmountInfo({
    tokenInfo,
    desc,
    network,
    amount,
    setAmount,
    tokenBalance,
    accountId,
    networkId,
  });
  const balanceDetailsInfo = useAccountBalanceDetailsInfo({
    networkId,
    accountId,
    useRecycleBalance: tokenInfo?.isNative ?? true,
    useCustomAddressesBalance,
  });

  return (
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      header={intl.formatMessage({ id: 'content__amount' })}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled:
          !!errorMsg || !minAmountValidationPassed || !!invalidAmountError,
        isLoading,
      }}
      onPrimaryActionPress={async () => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        const amountToSend = isFiatMode ? amount : text;
        if (transferInfo) {
          transferInfo.amount = amountToSend;
          transferInfo.from = account.address;
        }
        if (useCustomAddressesBalance) {
          transferInfo.useCustomAddressesBalance = true;
        }

        try {
          setIsLoading(true);
          await wait(100);

          const encodedTx = await engine.buildEncodedTxFromTransfer({
            networkId,
            accountId,
            transferInfo,
          });

          navigation.navigate(SendModalRoutes.SendConfirm, {
            accountId,
            networkId,
            encodedTx,
            feeInfoUseFeeInTx: false,
            feeInfoEditable: true,
            backRouteName: SendModalRoutes.PreSendAddress,
            payload: {
              payloadType: 'Transfer',
              account,
              network,
              token: {
                ...tokenInfo,
                sendAddress: transferInfo.tokenSendAddress,
                idOnNetwork: tokenInfo?.tokenIdOnNetwork ?? '',
              },
              to: transferInfo.to,
              value: amountToSend,
              isMax: false,
            },
          });
        } catch (e: any) {
          console.error(e);
          const { key: errorKey = '' } = e;
          if (errorKey === 'form__amount_invalid') {
            ToastManager.show(
              {
                title: intl.formatMessage(
                  { id: 'form__amount_invalid' },
                  { 0: tokenInfo?.symbol ?? '' },
                ),
              },
              { type: 'error' },
            );
          } else {
            deviceUtils.showErrorToast(e);
          }
        } finally {
          setIsLoading(false);
        }
      }}
    >
      <Box
        flex={1}
        flexDirection="column"
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
      >
        <PreSendAmountAlert
          accountId={accountId}
          networkId={networkId}
          tokenId={tokenInfo?.id ?? ''}
          amount={amount}
        />
        <Box flexDirection="row" alignItems="baseline">
          <Typography.Body2Strong mr={2} color="text-subdued">
            {intl.formatMessage({ id: 'content__to' })}:
          </Typography.Body2Strong>
          <Typography.Body1>
            {shortenAddress(transferInfo?.to ?? '')}
          </Typography.Body1>
        </Box>
        {/* Preview */}
        <Box
          py={isSmallScreen ? 4 : undefined}
          my={6}
          flex={1}
          justifyContent="center"
        >
          <PreSendAmountPreview
            title={title}
            titleAction={titleAction}
            desc={descView}
            text={text}
            onChangeText={onTextChange}
          />
        </Box>
        {/* Keyboard */}
        <Box mt="auto">
          <Box flexDirection="row" alignItems="center">
            <Box flex={1}>
              <BalanceTypeMenu
                accountId={accountId}
                networkId={networkId}
                callback={(value) =>
                  setuseCustomAddressesBalance(value === 'Manually')
                }
              />
              <Pressable
                onPress={
                  balanceDetailsInfo.enabled
                    ? () =>
                        showAccountBalanceDetailsOverlay({
                          info: balanceDetailsInfo,
                        })
                    : undefined
                }
                flexDirection="row"
                alignItems="center"
              >
                <FormatBalanceTokenOfAccount
                  accountId={accountId}
                  networkId={networkId}
                  token={{
                    id: tokenInfo?.id ?? '',
                    name: tokenInfo?.name ?? '',
                    ...(tokenInfo || {}),
                    sendAddress: transferInfo.tokenSendAddress,
                  }}
                  useRecycleBalance={tokenInfo?.isNative ?? true}
                  useCustomAddressesBalance={useCustomAddressesBalance}
                  render={(ele) => (
                    <Typography.Body1Strong
                      color={
                        errorMsg && amount ? 'text-critical' : 'text-default'
                      }
                    >
                      {ele}
                    </Typography.Body1Strong>
                  )}
                />
                {balanceDetailsInfo.enabled ? (
                  <Box ml={2}>
                    <Icon name="InformationCircleSolid" size={18} />
                  </Box>
                ) : null}
              </Pressable>
              {shouldShowFrozenBalance ? (
                <Typography.Caption color="text-subdued" mt={2}>
                  {`${intl.formatMessage({
                    id: 'form__frozen_balance',
                  })}: ${new BigNumber(frozenBalance ?? '0').toFixed()} ${
                    tokenInfo?.symbol ?? ''
                  }`}
                </Typography.Caption>
              ) : null}
            </Box>
            <Button
              onPress={() => {
                setTextByAmount(tokenBalance ?? '0');
              }}
            >
              {intl.formatMessage({ id: 'action__max' })}
            </Button>
          </Box>

          {(platformEnv.isNative || (platformEnv.isDev && isSmallScreen)) && (
            <Box mt={6}>
              <Keyboard
                itemHeight={shortScreen ? '44px' : undefined}
                // pattern={/^(0|([1-9][0-9]*))?\.?([0-9]{1,2})?$/}
                pattern={validAmountRegex}
                text={text}
                onTextChange={onTextChange}
              />
            </Box>
          )}
        </Box>
      </Box>
    </BaseSendModal>
  );
}

export { PreSendAmount };
