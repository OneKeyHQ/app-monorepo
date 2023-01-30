import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Switch, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { setIncludeNFTsInTotal } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import {
  BottomSheetSettingRow,
  BottomSheetSettings,
} from './BottomSheetSettings';

const AccountValueSettings: FC = () => {
  const intl = useIntl();
  const includeNFTsInTotal =
    useAppSelector((s) => s.settings.includeNFTsInTotal) ?? true;
  return (
    <>
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
