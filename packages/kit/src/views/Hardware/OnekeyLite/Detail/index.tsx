import React, { useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Dialog,
  Icon,
  Input,
  Select,
  useLocale,
} from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import { SelectItem } from '@onekeyhq/components/src/Select';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteModalRoutes,
  OnekeyLiteResetModalRoutes,
  OnekeyLiteResetRoutesParams,
  OnekeyLiteRoutesParams,
} from '../routes';

type OptionType = 'restore' | 'change_pin' | 'reset' | 'backup';

type NavigationProps = ModalScreenProps<OnekeyLiteRoutesParams> &
  ModalScreenProps<OnekeyLiteChangePinRoutesParams> &
  ModalScreenProps<OnekeyLiteResetRoutesParams>;

const OnekeyLiteDetail: React.FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { locale } = useLocale();
  const [url, setUrl] = useState('');

  const { wallet } = useActiveWalletAccount();

  const [selectBackupWalletVisible, setSelectBackupWalletVisible] =
    useState(false);
  const [resetDialogVisible, setResetDialogVisible] = useState<boolean>(false);
  const [resetAllow, setResetAllow] = useState<boolean | null>(null);
  const [resetValidationInput, setResetValidationInput] = useState('');
  const [currentOptionType, setCurrentOptionType] = useState<OptionType | null>(
    null,
  );

  const [controlledWallets, setControlledWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    setUrl(`https://lite.onekey.so/?language=${locale}`);
  }, [locale]);

  useEffect(() => {
    async function main() {
      if (!wallet) return;

      const wallets = (await backgroundApiProxy.engine.getWallets()).filter(
        (_wallet) => _wallet.type === 'hd' || _wallet.type === 'imported',
      );
      setControlledWallets(wallets);
    }
    main();
  }, [wallet]);

  useEffect(() => {
    const menuOptions: SelectItem<OptionType>[] = [];
    menuOptions.push({
      label: intl.formatMessage({
        id: 'action__restore_with_onekey_lite',
      }),
      value: 'restore',
      iconProps: { name: 'SaveAsOutline' },
    });

    menuOptions.push({
      label: intl.formatMessage({
        id: 'action__change_pin',
      }),
      value: 'change_pin',
      iconProps: { name: 'PencilAltOutline' },
    });
    menuOptions.push({
      label: intl.formatMessage({
        id: 'action__reset_onekey_lite',
      }),
      value: 'reset',
      iconProps: { name: 'TrashOutline', color: 'icon-critical' },
      color: 'icon-critical',
    });

    navigation.setOptions({
      title: 'OneKey Lite',
      headerRight: () => (
        <Select
          dropdownPosition="right"
          title="Onekey Lite"
          onChange={(v) => {
            if (currentOptionType !== v) setCurrentOptionType(v);
          }}
          footer={null}
          activatable={false}
          triggerProps={{
            width: '40px',
          }}
          dropdownProps={{
            width: 248,
          }}
          options={menuOptions}
          renderTrigger={() => (
            <Box mr={Platform.OS !== 'android' ? 4 : 0} alignItems="flex-end">
              <Icon name="DotsHorizontalOutline" />
            </Box>
          )}
        />
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intl, navigation]);

  const startRestoreModal = (inputPwd: string, callBack: () => void) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLite,
      params: {
        screen: OnekeyLiteModalRoutes.OnekeyLiteRestoreModal,
        params: {
          pwd: inputPwd,
          onRetry: () => {
            callBack?.();
          },
        },
      },
    });
  };

  const startRestorePinVerifyModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLite,
      params: {
        screen: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
        params: {
          callBack: (inputPwd) => {
            startRestoreModal(inputPwd, () => {
              console.log('restartRestorePinVerifyModal');
              startRestorePinVerifyModal();
            });
            return true;
          },
        },
      },
    });
  };

  const startChangePinInputPinModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLiteChangePinInputPin,
      params: {
        screen: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal,
      },
    });
  };

  useEffect(() => {
    switch (currentOptionType) {
      case 'restore':
        startRestorePinVerifyModal();
        setCurrentOptionType(null);
        break;
      case 'change_pin':
        startChangePinInputPinModal();
        setCurrentOptionType(null);
        break;
      case 'reset':
        setResetDialogVisible(true);
        setCurrentOptionType(null);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOptionType]);

  useEffect(() => {
    if (resetValidationInput.toUpperCase() === 'RESET') {
      setResetAllow(true);
    } else if (resetValidationInput.trim().length === 0) {
      setResetAllow(null);
    } else {
      setResetAllow(false);
    }
  }, [resetValidationInput]);

  const renderOptions = useMemo(() => {
    if (controlledWallets.length) {
      return (
        <Button
          onPress={() => {
            setSelectBackupWalletVisible(true);
          }}
          size="xl"
          m={4}
          type="primary"
        >
          {intl.formatMessage({ id: 'action__back_up_to_onekey_lite' })}
        </Button>
      );
    }
    return (
      <Button
        size="xl"
        m={4}
        type="primary"
        onPress={() => {
          startRestorePinVerifyModal();
        }}
      >
        {intl.formatMessage({ id: 'action__restore_with_onekey_lite' })}
      </Button>
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledWallets.length, intl]);

  return (
    <>
      <Box flexDirection="column" flex={1}>
        <Box flex={1}>
          <WebView src={url} />
        </Box>

        <Box bg="surface-subdued" pb={Platform.OS === 'ios' ? 4 : 0}>
          {renderOptions}
        </Box>
        <Dialog
          visible={resetDialogVisible}
          footerMoreView={
            <Box mb={3}>
              <Input
                w="full"
                value={resetValidationInput}
                isInvalid={resetAllow != null ? !resetAllow : false}
                onChangeText={setResetValidationInput}
              />
            </Box>
          }
          contentProps={{
            iconType: 'danger',
            title: intl.formatMessage({ id: 'action__reset_onekey_lite' }),
            content: intl.formatMessage({
              id: 'modal__reset_onekey_lite_desc',
            }),
          }}
          footerButtonProps={{
            onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
              onClose?.();
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.OnekeyLiteReset,
                params: {
                  screen: OnekeyLiteResetModalRoutes.OnekeyLiteResetModal,
                },
              });
            },
            primaryActionTranslationId: 'action__delete',
            primaryActionProps: {
              isDisabled: !resetAllow,
              type: 'destructive',
            },
          }}
          onClose={() => {
            setResetDialogVisible(false);
            setResetValidationInput('');
          }}
        />
      </Box>
      <Select
        visible={selectBackupWalletVisible}
        onVisibleChange={setSelectBackupWalletVisible}
        onChange={(walletId) => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.BackupWallet,
            params: {
              screen: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
              params: {
                walletId,
                backupType: 'OnekeyLite',
              },
            },
          });
        }}
        title={intl.formatMessage({ id: 'title_select_wallet' })}
        footer={null}
        activatable={false}
        dropdownPosition="right"
        containerProps={{
          zIndex: 5,
        }}
        options={controlledWallets.map((_wallet) => ({
          label: _wallet.name,
          description: intl.formatMessage(
            { id: 'form__str_accounts' },
            { count: _wallet.accounts.length.toString() },
          ),
          value: _wallet.id,
          tokenProps: {
            address: _wallet.id,
          },
        }))}
        renderTrigger={() => <Box />}
      />
    </>
  );
};

export default OnekeyLiteDetail;
