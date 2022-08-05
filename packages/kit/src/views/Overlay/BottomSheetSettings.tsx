import { FC, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import {
  Box,
  Modal,
  Switch,
  Typography,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { setHideSmallBalance } from '../../store/reducers/settings';
import { showOverlayFactory } from '../../utils/overlayUtils';

export const BottomSheetSettings: FC<{ onClose: () => void }> = ({
  onClose,
  children,
}) => {
  const modalizeRef = useRef<Modalize>(null);
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);

  return isVerticalLayout ? (
    <Modalize
      ref={modalizeRef}
      onClosed={onClose}
      closeOnOverlayTap
      adjustToContentHeight
    >
      <Box px="16px" py="24px" bg="surface-subdued">
        {children}
      </Box>
    </Modalize>
  ) : (
    <Modal
      visible
      header={intl.formatMessage({ id: 'title__settings' })}
      footer={null}
      closeAction={onClose}
    >
      {children}
    </Modal>
  );
};

export const showBottomSheetSettings = showOverlayFactory(BottomSheetSettings);

const HomeBalanceSettings: FC = () => {
  const intl = useIntl();
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const { themeVariant } = useTheme();
  return (
    <Box bg="surface-subdued">
      <Box
        p="16px"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
        borderRadius="12"
        bg="surface-default"
        justifyContent="space-between"
        flexDirection="row"
      >
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
      </Box>
    </Box>
  );
};
export const showHomeBalanceSettings = () =>
  showBottomSheetSettings({
    children: <HomeBalanceSettings />,
  });
