import React, { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { Box, Button, Icon, Select, useLocale } from '@onekeyhq/components';

import { useNavigation } from '../../../..';
import WebView from '../../../../components/WebView';
import { ModalRoutes } from '../../../../routes';
import { HardwareConnectStackNavigationProp } from '../../Connect/types';
import { HardwarePinCodeStackNavigationProp } from '../PinCode/types';

export type OnekeyLiteDetailViewProps = {
  liteId: string;
};

type OptionType = 'restore' | 'change_pin' | 'reset';

type NavigationProps = HardwareConnectStackNavigationProp &
  HardwarePinCodeStackNavigationProp;

const OnekeyLiteDetail: React.FC<OnekeyLiteDetailViewProps> = ({ liteId }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { locale } = useLocale();
  const url = `https://lite.onekey.so/?language=${locale}`;

  const [currentOptionType, setCurrentOptionType] = useState<OptionType | null>(
    null,
  );

  useEffect(() => {
    switch (currentOptionType) {
      case 'restore':
        navigation.navigate(ModalRoutes.HardwarePinCodeModal, {
          defaultValues: {
            title: 'Setup New PIN',
            description: 'Set a PIN for OneKey Lite',
          },
        });
        setCurrentOptionType(null);
        break;
      case 'change_pin':
        navigation.navigate(ModalRoutes.HardwareConnectModal, {
          defaultValues: {
            title: 'sdf',
            connectType: 'ble',
          },
        });
        setCurrentOptionType(null);
        break;
      case 'reset':
        break;
      default:
        break;
    }
  }, [currentOptionType, navigation]);

  useEffect(() => {
    console.log(liteId);
  }, [liteId]);

  navigation.setOptions({
    title: 'OneKey Lite',
    headerRight: () => (
      <Select
        title="Onekey lite"
        onChange={(v) => {
          if (currentOptionType !== v) setCurrentOptionType(v);
        }}
        value=""
        footer={null}
        dropdownPosition="right"
        containerProps={{
          width: '20px',
          zIndex: 5,
        }}
        options={[
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
        ]}
        renderTrigger={() => <Icon name="DotsHorizontalOutline" />}
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
          title="Select Wallet"
          onChange={(v) => setCurrentOptionType(v)}
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
    </Box>
  );
};

export default OnekeyLiteDetail;
