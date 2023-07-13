import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Skeleton, Switch, Typography } from '@onekeyhq/components';
import type { IBalanceDetails } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNativeToken,
} from '../../hooks';
import { setIncludeNFTsInTotal } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import {
  BottomSheetSettingRow,
  BottomSheetSettings,
} from './BottomSheetSettings';

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

function AccountBalanceDetailsPanel() {
  const intl = useIntl();
  const { accountId, networkId } = useActiveWalletAccount();
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
  }, [accountId, networkId]);

  if (!balanceDetails && !isLoading) {
    // this network may not implement fetchBalanceDetails API
    return null;
  }

  return (
    <Box>
      {isLoading ? (
        <Skeleton shape="DisplayXLarge" />
      ) : (
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
      )}
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
      <Box h={4} />
    </Box>
  );
}

const AccountValueSettings: FC = () => {
  const intl = useIntl();
  const includeNFTsInTotal =
    useAppSelector((s) => s.settings.includeNFTsInTotal) ?? true;

  return (
    <>
      <AccountBalanceDetailsPanel />

      <BottomSheetSettingRow
      // borderBottomRadius={0}
      >
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__include_nfts_in_totals' })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={includeNFTsInTotal}
          onToggle={() =>
            backgroundApiProxy.dispatch(
              setIncludeNFTsInTotal(!includeNFTsInTotal),
            )
          }
        />
      </BottomSheetSettingRow>
      {/* <BottomSheetSettingRow borderTopRadius={0} borderTopWidth={0}>
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__hide_balance' })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={hideBalance !== false}
          onToggle={() =>
            backgroundApiProxy.dispatch(setHideBalance(!hideBalance))
          }
        />
      </BottomSheetSettingRow> */}
    </>
  );
};
export const showAccountValueSettings = () =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <AccountValueSettings />
    </BottomSheetSettings>
  ));
