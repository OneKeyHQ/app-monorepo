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
  useThemeValue,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import {
  setHideSmallBalance,
  setIncludeNFTsInTotal,
} from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

export const BottomSheetSettings: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
  children,
}) => {
  const modalizeRef = useRef<Modalize>(null);
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  const [bg, handleBg] = useThemeValue(['surface-subdued', 'icon-subdued']);

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
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
      header={intl.formatMessage({ id: 'title__settings' })}
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

const SettingRow: FC<{
  borderTopRadius?: number | string;
  borderBottomRadius?: number | string;
  borderTopWidth?: number | string;
}> = ({ children, borderTopRadius, borderBottomRadius, borderTopWidth }) => {
  const { themeVariant } = useTheme();
  return (
    <Box
      p="16px"
      borderWidth={themeVariant === 'light' ? 1 : undefined}
      borderColor="border-subdued"
      borderRadius="12"
      borderTopRadius={borderTopRadius}
      borderBottomRadius={borderBottomRadius}
      borderTopWidth={borderTopWidth}
      bg="surface-default"
      justifyContent="space-between"
      flexDirection="row"
      alignItems="center"
    >
      {children}
    </Box>
  );
};

const HomeBalanceSettings: FC = () => {
  const intl = useIntl();
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  return (
    <SettingRow>
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
    </SettingRow>
  );
};
export const showHomeBalanceSettings = () =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <HomeBalanceSettings />
    </BottomSheetSettings>
  ));

const AccountValueSettings: FC = () => {
  const intl = useIntl();
  const { includeNFTsInTotal = true } = useAppSelector((s) => s.settings);
  return (
    <>
      <SettingRow
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
      </SettingRow>
      {/* <SettingRow borderTopRadius={0} borderTopWidth={0}>
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
      </SettingRow> */}
    </>
  );
};
export const showAccountValueSettings = () =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <AccountValueSettings />
    </BottomSheetSettings>
  ));
