import React, { FC, useEffect } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Badge,
  Box,
  Icon,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { BadgeType } from '@onekeyhq/components/src/Badge';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useToast } from '../../hooks/useToast';
import { ModalRoutes, RootRoutes } from '../../routes/types';

import { BackupType } from './types';

export type BackupWalletViewProps = {
  walletId: string;
};

export type BackupItemProps = {
  iconName: ICON_NAMES;
  title: string;
  describe?: string;
  badge?: string;
  badgeType?: BadgeType;
  onPress?: () => void;
};
const BackupItemDefaultProps = {
  badgeType: 'default',
} as const;

const BackupItem: FC<BackupItemProps> = ({
  iconName,
  title,
  describe,
  badge,
  badgeType,
  onPress,
}) => (
  <Pressable.Item borderRadius={12} onPress={() => onPress?.()}>
    <Box>
      <Box flexDirection="row" alignItems="center">
        <Icon size={24} name={iconName} />
        <Typography.Body1Strong ml={3} flex={1}>
          {title}
        </Typography.Body1Strong>
        <Box>
          {badge ? (
            <Badge title={badge} size="sm" type={badgeType} />
          ) : (
            <Icon title={badge} size={24} name="ChevronRightSolid" />
          )}
        </Box>
      </Box>
      {describe && (
        <Typography.Body1 mt={2} color="text-subdued">
          {describe}
        </Typography.Body1>
      )}
    </Box>
  </Pressable.Item>
);
BackupItem.defaultProps = BackupItemDefaultProps;

const BackupWalletViewModal: FC<BackupWalletViewProps> = ({ walletId }) => {
  const intl = useIntl();
  const toast = useToast();

  const navigation = useNavigation();
  const hasSupportCloud = Platform.OS === 'ios';
  const hasSupportNFC = Platform.OS === 'ios' || Platform.OS === 'android';

  const onManualBackup = (backupType: BackupType) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BackupWallet,
      params: {
        screen: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
        params: {
          walletId,
          backupType,
        },
      },
    });
  };

  useEffect(() => {
    if (!platformEnv.isNative) {
      if (navigation.canGoBack()) navigation.goBack();

      onManualBackup('Manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__backup' })}
      footer={null}
      scrollViewProps={{
        children: (
          <Column space={4} p={0.5}>
            {hasSupportCloud && (
              <BackupItem
                iconName="CloudOutline"
                title={intl.formatMessage({ id: 'backup__icloud_backup' })}
                describe={intl.formatMessage({
                  id: 'backup__icloud_backup_desc',
                })}
                badge={intl.formatMessage({ id: 'badge__coming_soon' })}
                onPress={() => {
                  // onManualBackup('iCloud');
                  toast.info(intl.formatMessage({ id: 'badge__coming_soon' }));
                }}
              />
            )}

            {hasSupportNFC && (
              <BackupItem
                iconName="OnekeyLiteOutline"
                title={intl.formatMessage({ id: 'backup__onekey_lite_backup' })}
                describe={intl.formatMessage({
                  id: 'backup__onekey_lite_backup_desc',
                })}
                // badge={intl.formatMessage({ id: 'badge__backed_up' })}
                badgeType="success"
                onPress={() => onManualBackup('OnekeyLite')}
              />
            )}

            <BackupItem
              iconName="DocumentTextOutline"
              title={intl.formatMessage({ id: 'backup__manual_backup' })}
              describe={intl.formatMessage({
                id: 'backup__manual_backup_desc',
              })}
              onPress={() => onManualBackup('Manual')}
            />
          </Column>
        ),
      }}
    />
  );
};

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletModal
>;

const BackupWalletView: FC = () => {
  const { walletId } = useRoute<RouteProps>().params;
  return <BackupWalletViewModal walletId={walletId} />;
};

export { BackupWalletView, BackupWalletViewModal };
