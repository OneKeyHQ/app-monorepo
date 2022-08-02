import { FC, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import { Box, Dialog, Modal, useIsVerticalLayout } from '@onekeyhq/components';
// import { DesktopModalInner } from '@onekeyhq/components/src/Modal/Container/Desktop';

import { showOverlayFactory } from '../../utils/overlayUtils';

export const BottomSheetSettings: FC<{ onClose: () => void }> = ({
  onClose,
  children,
}) => {
  const modalizeRef = useRef<Modalize>(null);
  //   const isVerticalLayout = useIsVerticalLayout();
  //   const intl = useIntl();

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);

  return (
    <Modalize
      ref={modalizeRef}
      onClosed={onClose}
      closeOnOverlayTap
      adjustToContentHeight
    >
      {children}
    </Modalize>
  );
};

export const showBottomSheetSettings = showOverlayFactory(BottomSheetSettings);

export const showHomeBalanceSettings = () =>
  showBottomSheetSettings({
    children: <Box h="100" w="100" bg="red.100" />,
  });
