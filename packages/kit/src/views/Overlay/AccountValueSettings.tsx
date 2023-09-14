import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useAppSelector } from '../../hooks';
import { useShouldHideInscriptions } from '../../hooks/crossHooks/useShouldHideInscriptions';
import { setIncludeNFTsInTotal } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import {
  AccountBalanceDetailsPanel,
  useAccountBalanceDetailsInfo,
} from './AccountBalanceDetailsPanel';
import {
  BottomSheetSettingRow,
  BottomSheetSettings,
} from './BottomSheetSettings';

const AccountValueSettings: FC = () => {
  const intl = useIntl();
  const includeNFTsInTotal =
    useAppSelector((s) => s.settings.includeNFTsInTotal) ?? true;

  const { accountId, networkId } = useActiveWalletAccount();
  const info = useAccountBalanceDetailsInfo({
    networkId,
    accountId,
    useRecycleBalance: true,
  });
  const shouldHideInscriptions = useShouldHideInscriptions({
    accountId,
    networkId,
  });

  return (
    <>
      <AccountBalanceDetailsPanel info={info} />
      {info.enabled ? <Box h={4} /> : null}
      {shouldHideInscriptions ? null : (
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
      )}
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
