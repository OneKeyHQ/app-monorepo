import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Skeleton, Typography } from '@onekeyhq/components';
import type { IBalanceDetails } from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNativeToken } from '../../hooks';
import { showOverlay } from '../../utils/overlayUtils';

import { BottomSheetSettings } from './BottomSheetSettings';

function AccountBalanceDetailsRow({
  label,
  amount,
  symbol,
  alwaysShow,
}: {
  label: string;
  amount?: string;
  symbol?: string;
  alwaysShow?: boolean;
}) {
  if (!amount || amount === '0') {
    if (!alwaysShow) {
      return null;
    }
  }
  return (
    <Box
      justifyContent="space-between"
      flexDirection="row"
      alignItems="center"
      // mt={mt}
    >
      <Typography.Body2Strong color="text-subdued">
        {label}
      </Typography.Body2Strong>
      <Typography.Body2>
        {amount} {symbol}
      </Typography.Body2>
    </Box>
  );
}

export function useAccountBalanceDetailsInfo({
  accountId,
  networkId,
  useRecycleBalance,
  isInscribe,
  useCustomAddressesBalance,
}: {
  accountId: string;
  networkId: string;
  useRecycleBalance?: boolean;
  isInscribe?: boolean;
  useCustomAddressesBalance?: boolean;
}) {
  const intl = useIntl();
  const [balanceDetails, setBalanceDetails] = useState<
    IBalanceDetails | undefined
  >();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const nativeToken = useNativeToken(networkId);
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const result =
          await backgroundApiProxy.serviceToken.fetchBalanceDetails({
            accountId,
            networkId,
            useRecycleBalance,
            isInscribe,
            useCustomAddressesBalance,
          });
        setBalanceDetails(result);
        setIsLoading(false);
        if (result?.errorMessageKey) {
          setErrorMsg(
            intl.formatMessage({
              id: result?.errorMessageKey,
            }),
          );
        }
      } catch (error) {
        console.error(error);
        setErrorMsg(
          intl.formatMessage({
            id: 'msg__rpc_node_failure_refresh_and_try_again',
          }),
        );
      } finally {
        // noop
      }
    })();
  }, [
    accountId,
    intl,
    networkId,
    useRecycleBalance,
    isInscribe,
    useCustomAddressesBalance,
  ]);

  let enabled = true;
  if (!balanceDetails && !isLoading) {
    // this network may not implement fetchBalanceDetails API
    enabled = false;
  }

  return {
    enabled,
    balanceDetails,
    isLoading,
    errorMsg,
    nativeToken,
  };
}

export function AccountBalanceDetailsPanel({
  info,
}: {
  info: ReturnType<typeof useAccountBalanceDetailsInfo>;
}) {
  const intl = useIntl();
  const { networkId } = useActiveWalletAccount();

  const { enabled, balanceDetails, isLoading, nativeToken, errorMsg } = info;

  const renderBalanceDetails = useCallback(() => {
    if (isLoading) {
      return <Skeleton shape="DisplayXLarge" />;
    }

    if (networkId === OnekeyNetwork.sol) {
      return (
        <>
          <Typography.DisplayXLarge>
            {balanceDetails?.total} {nativeToken?.symbol}
          </Typography.DisplayXLarge>
          <AccountBalanceDetailsRow
            alwaysShow
            label={intl.formatMessage({ id: 'content__spendable' })}
            amount={balanceDetails?.available}
            symbol={nativeToken?.symbol}
          />
          <AccountBalanceDetailsRow
            alwaysShow
            label={intl.formatMessage({ id: 'content__rent' })}
            amount={balanceDetails?.unavailable}
            symbol={nativeToken?.symbol}
          />
        </>
      );
    }
    return (
      <>
        <Typography.DisplayXLarge>
          {balanceDetails?.total} {nativeToken?.symbol}
        </Typography.DisplayXLarge>
        <AccountBalanceDetailsRow
          alwaysShow
          label={intl.formatMessage({ id: 'content__spendable' })}
          amount={balanceDetails?.available}
          symbol={nativeToken?.symbol}
        />
        <AccountBalanceDetailsRow
          label={intl.formatMessage({ id: 'content__frozen' })}
          amount={balanceDetails?.unavailableOfLocalFrozen}
          symbol={nativeToken?.symbol}
        />
        <AccountBalanceDetailsRow
          label={intl.formatMessage({ id: 'content__inscriptions_occupy' })}
          amount={balanceDetails?.unavailableOfInscription}
          symbol={nativeToken?.symbol}
        />
        <AccountBalanceDetailsRow
          label={intl.formatMessage({ id: 'content__unconfirmed' })}
          amount={balanceDetails?.unavailableOfUnconfirmed}
          symbol={nativeToken?.symbol}
        />
        <AccountBalanceDetailsRow
          label={intl.formatMessage({ id: 'content__unusable' })}
          amount={balanceDetails?.unavailableOfUnchecked}
          symbol={nativeToken?.symbol}
        />
      </>
    );
  }, [
    balanceDetails?.available,
    balanceDetails?.total,
    balanceDetails?.unavailable,
    balanceDetails?.unavailableOfInscription,
    balanceDetails?.unavailableOfLocalFrozen,
    balanceDetails?.unavailableOfUnchecked,
    balanceDetails?.unavailableOfUnconfirmed,
    intl,
    isLoading,
    nativeToken?.symbol,
    networkId,
  ]);

  if (!enabled) {
    // this network may not implement fetchBalanceDetails API
    return null;
  }

  return (
    <Box>
      {renderBalanceDetails()}
      {errorMsg ? (
        <Box flexDirection="row" alignItems="center">
          <Icon
            name="ExclamationTriangleOutline"
            size={16}
            color="text-warning"
          />
          <Typography.Caption ml={1} color="text-warning">
            {errorMsg}
          </Typography.Caption>
        </Box>
      ) : null}
    </Box>
  );
}

export function showAccountBalanceDetailsOverlay({
  info,
}: {
  info: ReturnType<typeof useAccountBalanceDetailsInfo>;
}) {
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      closeOverlay={closeOverlay}
      titleI18nKey="content__account_balance"
    >
      <AccountBalanceDetailsPanel info={info} />
    </BottomSheetSettings>
  ));
}
