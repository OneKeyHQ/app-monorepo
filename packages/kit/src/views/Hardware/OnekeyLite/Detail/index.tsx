import React, { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { Box, Button, Icon, Select, useLocale } from '@onekeyhq/components';

import { useNavigation } from '../../../..';
import WebView from '../../../../components/WebView';

export type OnekeyLiteDetailViewProps = {
  liteId: string;
};

const OnekeyLiteDetail: React.FC<OnekeyLiteDetailViewProps> = ({ liteId }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { locale } = useLocale();
  const url = `https://lite.onekey.so/?language=${locale}`;

  useEffect(() => {
    console.log(liteId);
  }, [liteId]);

  const [value, setValue] = useState('');

  useEffect(() => {
    console.log(value);
    console.log(liteId);
  }, [liteId, value]);

  navigation.setOptions({
    title: 'OneKey Lite',
    headerRight: () => (
      <Select
        title="Onekey lite"
        onChange={(v) => setValue(v)}
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
            value: '1',
            iconProps: { name: 'SaveAsOutline' },
          },
          {
            label: intl.formatMessage({
              id: 'action__change_pin',
            }),
            value: '2',
            iconProps: { name: 'PencilAltOutline' },
          },
          {
            label: intl.formatMessage({
              id: 'action__reset_onekey_lite',
            }),
            value: '3',
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
          onChange={(v) => setValue(v)}
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
