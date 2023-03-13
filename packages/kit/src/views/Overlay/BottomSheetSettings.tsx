import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import {
  Box,
  Modal,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';

export const BottomSheetSettings: FC<{
  closeOverlay: () => void;
  titleI18nKey?: string;
}> = ({ closeOverlay, children, titleI18nKey }) => {
  const modalizeRef = useRef<Modalize>(null);
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  const [bg, handleBg] = useThemeValue(['surface-subdued', 'icon-subdued']);

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open());
  }, []);

  return isVerticalLayout ? (
    <Modalize
      ref={modalizeRef}
      onClosed={closeOverlay}
      closeOnOverlayTap
      adjustToContentHeight
      handlePosition="inside"
      modalStyle={{
        backgroundColor: bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
      }}
      handleStyle={{ backgroundColor: handleBg }}
      tapGestureEnabled={false}
    >
      <Box px="16px" py="24px" bg="surface-subdued">
        {children}
      </Box>
    </Modalize>
  ) : (
    <Modal
      visible
      forceDesktop
      header={intl.formatMessage({
        id: (titleI18nKey as any) ?? 'title__settings',
      })}
      footer={null}
      closeAction={closeOverlay}
      staticChildrenProps={{
        pt: 6,
        pb: 6,
        px: { base: 4, md: 6 },
        borderRadius: '24px',
      }}
    >
      {children}
    </Modal>
  );
};

export const BottomSheetSettingRow: FC<{
  mt?: number | string;
}> = ({ children, mt }) => (
  <Box
    justifyContent="space-between"
    flexDirection="row"
    alignItems="center"
    mt={mt}
  >
    {children}
  </Box>
);
