import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  HStack,
  Switch,
  Text,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { refreshHistory } from '../../store/reducers/refresher';
import { setHideScamHistory } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

function TokenValueSettingsBottomSheetModal({
  closeOverlay,
}: {
  closeOverlay: () => void;
}) {
  const intl = useIntl();
  const hideScamHistory =
    useAppSelector((s) => s.settings.hideScamHistory) ?? true;

  return (
    <BottomSheetModal
      modalLizeProps={{ tapGestureEnabled: false }}
      title={intl.formatMessage({ id: 'title__settings' })}
      closeOverlay={closeOverlay}
    >
      <Box pb={4} pr={2}>
        <Text typography="Subheading" color="text-subdued">
          {intl.formatMessage({ id: 'form__anti_scam' })}
        </Text>
        <Text typography="Body1Strong" mt={3}>
          {intl.formatMessage({ id: 'form__hide_0_amount_transfers' })}
        </Text>
        <HStack mt={1} alignItems="flex-start" space={3}>
          <Text typography="Body2" color="text-subdued" flex={1}>
            {intl.formatMessage({ id: 'form__hide_0_amount_transfers_desc' })}
          </Text>
          <Switch
            labelType="false"
            isChecked={hideScamHistory}
            onToggle={() =>
              backgroundApiProxy.dispatch(
                setHideScamHistory(!hideScamHistory),
                refreshHistory(),
              )
            }
          />
        </HStack>
      </Box>
    </BottomSheetModal>
  );
}

export const showTokenValueSettings = () => {
  showOverlay((close) => (
    <TokenValueSettingsBottomSheetModal closeOverlay={close} />
  ));
};
