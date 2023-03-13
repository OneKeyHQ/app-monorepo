import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Switch, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import {
  setHideRiskTokens,
  setHideSmallBalance,
  setPutMainTokenOnTop,
} from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import {
  BottomSheetSettingRow,
  BottomSheetSettings,
} from './BottomSheetSettings';

const HomeBalanceSettings: FC = () => {
  const intl = useIntl();
  const { hideSmallBalance, hideRiskTokens, putMainTokenOnTop } =
    useAppSelector((s) => s.settings);
  return (
    <>
      <Typography.Subheading mb="3" color="text-subdued">
        {intl.formatMessage({ id: 'form__preferences' })}
      </Typography.Subheading>
      <BottomSheetSettingRow>
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__hide_small_balance' })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={hideSmallBalance}
          onToggle={() =>
            backgroundApiProxy.dispatch(setHideSmallBalance(!hideSmallBalance))
          }
        />
      </BottomSheetSettingRow>
      <BottomSheetSettingRow mt="4">
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__put_coins_at_the_top' })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={putMainTokenOnTop}
          onToggle={() =>
            backgroundApiProxy.dispatch(
              setPutMainTokenOnTop(!putMainTokenOnTop),
            )
          }
        />
      </BottomSheetSettingRow>
      <Typography.Subheading mb="3" mt="8" color="text-subdued">
        {intl.formatMessage({ id: 'form__anti_scam' })}
      </Typography.Subheading>
      <BottomSheetSettingRow>
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__hide_risk_tokens' })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={hideRiskTokens}
          onToggle={() =>
            backgroundApiProxy.dispatch(setHideRiskTokens(!hideRiskTokens))
          }
        />
      </BottomSheetSettingRow>
    </>
  );
};
export const showHomeBalanceSettings = () =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <HomeBalanceSettings />
    </BottomSheetSettings>
  ));
