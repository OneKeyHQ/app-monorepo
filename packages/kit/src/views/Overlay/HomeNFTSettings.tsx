import { useIntl } from 'react-intl';

import { Switch, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccount } from '../../hooks';
import { useShouldHideInscriptions } from '../../hooks/useShouldHideInscriptions';
import { setHideInscriptions } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import {
  BottomSheetSettingRow,
  BottomSheetSettings,
} from './BottomSheetSettings';

function HomeNFTSettings({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const shouldHideInscriptions = useShouldHideInscriptions({
    accountId,
    networkId,
  });
  const { account } = useAccount({ accountId, networkId });

  return (
    <>
      <Typography.Subheading mb="3" color="text-subdued">
        {intl.formatMessage({ id: 'form__preferences' })}
      </Typography.Subheading>
      <BottomSheetSettingRow>
        <Typography.Body1Strong>
          {intl.formatMessage({
            id: 'form__disable_ordinals',
          })}
        </Typography.Body1Strong>
        <Switch
          labelType="false"
          isChecked={shouldHideInscriptions}
          onToggle={() =>
            backgroundApiProxy.dispatch(
              setHideInscriptions({ [accountId]: !shouldHideInscriptions }),
            )
          }
        />
      </BottomSheetSettingRow>
      <Typography.Body2 color="text-subdued" flex={1} mt={3}>
        {intl.formatMessage(
          {
            id: shouldHideInscriptions
              ? 'content__do_not_display_inscriptions_and_brc20_assets_this_config_only_applied_to_account_str'
              : 'content__inscriptions_and_brc20_assets_will_be_displayed_in_dashboard_this_config_only_applied_to_account_str',
          },
          { 0: account?.name ?? '' },
        )}
      </Typography.Body2>
    </>
  );
}
export const showHomeNFTSettings = (props: {
  accountId: string;
  networkId: string;
}) =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <HomeNFTSettings {...props} />
    </BottomSheetSettings>
  ));
