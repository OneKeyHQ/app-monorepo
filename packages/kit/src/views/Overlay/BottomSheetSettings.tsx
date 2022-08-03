import { FC, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import { Box, Modal, useIsVerticalLayout } from '@onekeyhq/components';

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
      {children}
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

export const showHomeBalanceSettings = () =>
  showBottomSheetSettings({
    children: <Box h="100" w="100" bg="red.100" />,
  });
