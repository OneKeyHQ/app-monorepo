import React, { ComponentProps, FC, useEffect } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Badge,
  Box,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { BadgeType } from '@onekeyhq/components/src/Badge';
import RecoveryPhrase from '@onekeyhq/kit/assets/3d_recovery_phrase.png';
import OneKeyLite from '@onekeyhq/kit/assets/onekey-lite.png';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ModalRoutes, RootRoutes } from '../../routes/types';

import { BackupType } from './types';

export type BackupWalletViewProps = {
  walletId: string;
};

export type BackupItemProps = {
  imageSrc: ComponentProps<typeof Image>['source'];
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
  imageSrc,
  title,
  describe,
  badge,
  badgeType,
  onPress,
}) => (
  <Pressable.Item borderRadius={12} onPress={() => onPress?.()}>
    <Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Image size={16} source={imageSrc} />
        <Box>
          {badge ? (
            <Badge title={badge} size="sm" type={badgeType} />
          ) : (
            <Icon title={badge} size={24} name="ChevronRightSolid" />
          )}
        </Box>
      </Box>
      <Typography.Body1Strong mt={4}>{title}</Typography.Body1Strong>
      {describe && (
        <Typography.Body1 mt={1} color="text-subdued">
          {describe}
        </Typography.Body1>
      )}
    </Box>
  </Pressable.Item>
);
BackupItem.defaultProps = BackupItemDefaultProps;

const BackupWalletViewModal: FC<BackupWalletViewProps> = ({ walletId }) => {
  const intl = useIntl();

  const navigation = useNavigation();
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
            <BackupItem
              imageSrc={RecoveryPhrase}
              title={intl.formatMessage({ id: 'backup__manual_backup' })}
              describe={intl.formatMessage({
                id: 'backup__manual_backup_desc',
              })}
              onPress={() => onManualBackup('Manual')}
            />
            {hasSupportNFC && (
              <BackupItem
                imageSrc={OneKeyLite}
                title={intl.formatMessage({ id: 'backup__onekey_lite_backup' })}
                describe={intl.formatMessage({
                  id: 'backup__onekey_lite_backup_desc',
                })}
                // badge={intl.formatMessage({ id: 'badge__backed_up' })}
                badgeType="success"
                onPress={() => onManualBackup('OnekeyLite')}
              />
            )}
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
