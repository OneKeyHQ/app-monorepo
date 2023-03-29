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
  Keyboard,
  Spinner,
  Text,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatBalanceTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import {
  useSingleToken,
  useTokenBalance,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks/useTokens';
import { wait } from '../../../utils/helper';
import { BaseSendModal } from '../components/BaseSendModal';
import { PreSendAmountAlert } from '../components/PreSendAmountAlert';
import { SendModalRoutes } from '../enums';
import { usePreSendAmountInfo } from '../utils/usePreSendAmountInfo';

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
  const descView = useMemo(() => {
    if (!desc) {
      return null;
    }
    if (isValidElement(desc)) {
      return <Center>{desc}</Center>;
    }
    return (
      <Text typography="Body1Strong" textAlign="center" isTruncated>
        {desc}
      </Text>
    );
  }, [desc]);
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

      {/* placeholder={intl.formatMessage({ id: 'content__amount' })} */}
      <Center flex={1} maxH="64px" mt={2} mb={3}>
        <AutoSizeText
          autoFocus
          text={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
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
      sendAddress: transferInfo.sendAddress,
    },
    fallback: '0',
  });

  const originalTokenBalance = useTokenBalance({
    networkId,
    accountId,
    token: {
      ...tokenInfo,
      sendAddress: transferInfo.sendAddress,
    },
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
      ) : invalidAmountError ? (
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
    ],
  );

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
                sendAddress: transferInfo.sendAddress,
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
            ToastManager.show(
              { title: typeof e === 'string' ? e : (e as Error).message },
              { type: 'error' },
            );
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
              <Typography.Caption color="text-subdued">
                {intl.formatMessage({ id: 'content__available_balance' })}
              </Typography.Caption>
              <Box>
                <FormatBalanceTokenOfAccount
                  accountId={accountId}
                  networkId={networkId}
                  token={{
                    id: tokenInfo?.id ?? '',
                    name: tokenInfo?.name ?? '',
                    ...(tokenInfo || {}),
                    sendAddress: transferInfo.sendAddress,
                  }}
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
              </Box>
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
