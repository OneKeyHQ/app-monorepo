import React, { useEffect, useState } from 'react';

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

import { useNavigation } from '../../../..';
import WebView from '../../../../components/WebView';
import { ModalRoutes } from '../../../../routes';
import { OnekeyLiteStackNavigationProp } from '../navigation';

export type OnekeyLiteDetailViewProps = {
  liteId: string;
};

type OptionType = 'restore' | 'change_pin' | 'reset';

type NavigationProps = OnekeyLiteStackNavigationProp;

const OnekeyLiteDetail: React.FC<OnekeyLiteDetailViewProps> = ({ liteId }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { locale } = useLocale();
  const url = `https://lite.onekey.so/?language=${locale}`;

  const [resetDialogVisible, setResetDialogVisible] = useState<boolean>(false);
  const [resetAllow, setResetAllow] = useState<boolean | null>(null);
  const [resetValidationInput, setResetValidationInput] = useState('');
  const [currentOptionType, setCurrentOptionType] = useState<OptionType | null>(
    null,
  );

  useEffect(() => {
    switch (currentOptionType) {
      case 'restore':
        navigation.navigate(ModalRoutes.OnekeyLiteBackupModal);
        setCurrentOptionType(null);
        break;
      case 'change_pin':
        navigation.navigate(ModalRoutes.OnekeyLiteChangePinModal);
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
    if (resetValidationInput === 'RESET') {
      setResetAllow(true);
    } else if (resetValidationInput.trim().length === 0) {
      setResetAllow(null);
    } else {
      setResetAllow(false);
    }
  }, [resetValidationInput]);

  useEffect(() => {
    console.log(liteId);
  }, [liteId]);

  const liteOption: SelectItem<OptionType>[] = [
    {
      label: intl.formatMessage({
        id: 'action__restore_with_onekey_lite',
      }),
      value: 'restore',
      iconProps: { name: 'SaveAsOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__change_pin',
      }),
      value: 'change_pin',
      iconProps: { name: 'PencilAltOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__reset_onekey_lite',
      }),
      value: 'reset',
      iconProps: { name: 'TrashOutline', color: 'icon-critical' },
      color: 'icon-critical',
    },
  ];

  navigation.setOptions({
    title: 'OneKey Lite',
    headerRight: () => (
      <Select
        title="Onekey Lite"
        onChange={(v) => {
          if (currentOptionType !== v) setCurrentOptionType(v);
        }}
        footer={null}
        asAction
        dropdownPosition="right"
        containerProps={{
          width: '20px',
          zIndex: 5,
        }}
        options={liteOption}
        renderTrigger={() => (
          <Box mr={Platform.OS !== 'android' ? 4 : 0} alignItems="flex-end">
            <Icon name="DotsHorizontalOutline" />
          </Box>
        )}
      />
    ),
  });

  return (
    <Box flexDirection="column" flex={1}>
      <Box flex={1}>
        <WebView src={url} />
      </Box>

      <Box mb={Platform.OS === 'ios' ? 4 : 0}>
        <Select
          title={intl.formatMessage({ id: 'title_select_wallet' })}
          value=""
          footer={null}
          dropdownPosition="right"
          containerProps={{
            zIndex: 5,
          }}
          options={[
            {
              label: 'Wallet #2',
              description: '5 accounts',
              value: '1',
              tokenProps: {
                address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
              },
            },
            {
              label: 'Wallet #3',
              description: '3 accounts',
              value: '1',
              tokenProps: {
                address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
              },
            },
          ]}
          renderTrigger={() => (
            <Button pointerEvents="none" size="lg" m={4} type="primary">
              {intl.formatMessage({ id: 'action__restore_with_onekey_lite' })}
            </Button>
          )}
        />
      </Box>
      <Dialog
        visible={resetDialogVisible}
        footerMoreView={
          <Box mb={3}>
            <Input
              value={resetValidationInput}
              isInvalid={resetAllow != null ? !resetAllow : false}
              onChangeText={setResetValidationInput}
            />
          </Box>
        }
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({ id: 'action__reset_onekey_lite' }),
          content: intl.formatMessage({ id: 'modal__reset_onekey_lite_desc' }),
        }}
        footerButtonProps={{
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            navigation.navigate(ModalRoutes.OnekeyLiteResetModal);
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
  );
};

export default OnekeyLiteDetail;
