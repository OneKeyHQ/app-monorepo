import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import type { BadgeType } from '@onekeyhq/components/src/Badge';
import RecoveryPhrase from '@onekeyhq/kit/assets/3d_recovery_phrase.png';
import OneKeyLite from '@onekeyhq/kit/assets/onekey-lite.png';
import type { BackupWalletRoutesParams } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';

import type { RouteProp } from '@react-navigation/core';

export type BackupWalletViewProps = {
  walletId: string;
};

export type BackupItemProps = {
  imageSrc: ComponentProps<typeof Image>['source'];
  title: string;
  discription?: string;
  badge?: string;
  // eslint-disable-next-line react/no-unused-prop-types
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
  onPress,
}) => (
  <Pressable.Item
    bgColor="action-secondary-default"
    borderWidth={StyleSheet.hairlineWidth}
    borderColor="border-default"
    borderRadius={12}
    onPress={() => onPress?.()}
  >
    <Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Image size={16} source={imageSrc} />
        <Box>
          <Icon
            title={badge}
            size={24}
            name="ChevronRightMini"
            color="icon-subdued"
          />
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
            {supportedNFC && (
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
