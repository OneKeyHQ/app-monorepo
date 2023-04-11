import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Dialog,
  Icon,
  Input,
  Pressable,
  Select,
  Text,
  useLocale,
} from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import type {
  CreateWalletRoutesParams,
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteResetRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  BackupWalletModalRoutes,
  CreateWalletModalRoutes,
  ModalRoutes,
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteResetModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type OptionType = 'restore' | 'change_pin' | 'reset' | 'backup';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams> &
  ModalScreenProps<OnekeyLiteChangePinRoutesParams> &
  ModalScreenProps<OnekeyLiteResetRoutesParams>;

const OnekeyLiteDetail: FC = () => {
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
    if (wallet) {
      backgroundApiProxy.engine
        .getWallets()
        .then((wallets) =>
          setControlledWallets(
            wallets.filter((_wallet) => _wallet.type === 'hd'),
          ),
        );
    }
  }, [wallet]);

  const menuOptionsMemo = useMemo(() => {
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

    return menuOptions;
  }, [intl]);

  const headerRightSelect = useCallback(
    () => (
      <Select
        dropdownPosition="right"
        title={intl.formatMessage({ id: 'app__hardware_name_onekey_lite' })}
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
        options={menuOptionsMemo}
        renderTrigger={() => (
          <Box mr={Platform.OS !== 'android' ? 4 : 0} alignItems="flex-end">
            <Icon name="DotsHorizontalOutline" />
          </Box>
        )}
      />
    ),
    [intl, menuOptionsMemo, currentOptionType],
  );

  useEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'app__hardware_name_onekey_lite' }),
      headerRight: () => headerRightSelect(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intl, menuOptionsMemo, navigation]);

  const startRestorePinVerifyModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
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

  const startResetModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLiteReset,
      params: {
        screen: OnekeyLiteResetModalRoutes.OnekeyLiteResetModal,
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
      case 'reset': {
        setResetDialogVisible(true);
        setCurrentOptionType(null);
        break;
      }
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
          {/* <WebViewWebEmbed */}
          {/*  routePath="/onboarding/auto_typing?pausedProcessIndex=0" */}
          {/*  // routePath="/abc" */}
          {/* /> */}
          {/* <ProcessAutoTypingWebView /> */}
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
                placeholder="RESET"
              />
            </Box>
          }
          contentProps={{
            iconType: 'danger',
            title: intl.formatMessage({ id: 'action__reset_onekey_lite' }),
            content: intl.formatMessage(
              {
                id: 'modal__reset_onekey_lite_desc',
              },
              { 0: 'RESET' },
            ),
          }}
          footerButtonProps={{
            onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
              onClose?.();
              setTimeout(() => {
                startResetModal();
              }, 500);
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
        onChange={(walletItem) => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.BackupWallet,
            params: {
              screen: BackupWalletModalRoutes.BackupWalletLiteModal,
              params: {
                walletId: walletItem.id,
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
          value: _wallet,
        }))}
        renderItem={(walletItem, isActive, onChange) => (
          <Pressable
            onPress={() => onChange?.(walletItem.value, walletItem)}
            flexDirection="row"
            alignItems="center"
            height="68px"
            paddingLeft="18px"
          >
            <WalletAvatar
              walletImage={walletItem.value.type}
              avatar={walletItem.value.avatar}
              size="sm"
              circular
            />
            <Box flexDirection="column" ml="12px">
              <Text typography="Body1Strong">{walletItem.label}</Text>
              <Text typography="Body2" color="text-subdued">
                {walletItem.description}
              </Text>
            </Box>
          </Pressable>
        )}
        renderTrigger={() => <Box />}
      />
    </>
  );
};

export default OnekeyLiteDetail;
