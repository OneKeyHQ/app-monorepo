import React, { ComponentProps, FC, useCallback } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

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
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type BackupWalletViewProps = {
  walletId: string;
};

export type BackupItemProps = {
  imageSrc: ComponentProps<typeof Image>['source'];
  title: string;
  discription?: string;
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
  discription,
  badge = 'default',
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
      {discription && (
        <Typography.Body1 mt={1} color="text-subdued">
          {discription}
        </Typography.Body1>
      )}
    </Box>
  </Pressable.Item>
);
BackupItem.defaultProps = BackupItemDefaultProps;

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletOptionsModal
>;

type NavigationProps = ModalScreenProps<BackupWalletRoutesParams>;

const BackupWalletOptionsView: FC<BackupWalletViewProps> = () => {
  const intl = useIntl();
  const { walletId } = useRoute<RouteProps>().params;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onManual = useCallback(() => {
    navigation.navigate(BackupWalletModalRoutes.BackupWalletManualModal, {
      walletId,
    });
  }, [navigation, walletId]);

  const onLite = useCallback(() => {
    navigation.navigate(BackupWalletModalRoutes.BackupWalletLiteModal, {
      walletId,
    });
  }, [navigation, walletId]);

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
              discription={intl.formatMessage({
                id: 'backup__manual_backup_desc',
              })}
              onPress={onManual}
            />
            {platformEnv.isNative && (
              <BackupItem
                imageSrc={OneKeyLite}
                title={intl.formatMessage({ id: 'backup__onekey_lite_backup' })}
                discription={intl.formatMessage({
                  id: 'backup__onekey_lite_backup_desc',
                })}
                badgeType="success"
                onPress={onLite}
              />
            )}
          </Column>
        ),
      }}
    />
  );
};

export default BackupWalletOptionsView;
