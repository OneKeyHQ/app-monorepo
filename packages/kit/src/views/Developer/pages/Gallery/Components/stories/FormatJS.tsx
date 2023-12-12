import { useIntl } from 'react-intl';

import { Stack, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const FormatJSGallery = () => {
  const intl = useIntl();
  return (
    <Layout
      description="所有格式化相关的 api 示例"
      suggestions={['更多例子请参考 https://formatjs.io/docs/react-intl/api']}
      boundaryConditions={[]}
      elements={[
        {
          title: '多语言',
          element: (
            <Stack>
              <Text bg="#293133" p={20} color="white">
                {`intl.formatMessage({ id: 'msg__sending_str_requires_an_account_balance_of_at_least_str_str' }, {'0': 'BTC', '1': '0.0001', '2': 'USDT'},
                )`}
              </Text>
              <Text mt={20} p={20} bg="#293133" color="white">
                {intl.formatMessage(
                  {
                    id: 'msg__sending_str_requires_an_account_balance_of_at_least_str_str',
                  },
                  {
                    '0': 'BTC',
                    '1': '0.0001',
                    '2': 'USDT',
                  },
                )}
              </Text>
            </Stack>
          ),
        },
        {
          title: '日期',
          element: (
            <Stack>
              <Text bg="#293133" p={20} color="white">
                {`intl.formatDate(new Date(), { format: 'default' })`}
              </Text>
              <Text mt={20} p={20} bg="#293133" color="white">
                {intl.formatDate(new Date(), { format: 'default' })}
              </Text>
            </Stack>
          ),
        },
        {
          title: '金额',
          element: (
            <Stack>
              <Text bg="#293133" p={20} color="white">
                {`intl.formatNumber(1000, {style: 'currency', currency: 'USD'})`}
              </Text>
              <Text mt={20} p={20} bg="#293133" color="white">
                {intl.formatNumber(1000, {
                  style: 'currency',
                  currency: 'USD',
                })}
              </Text>
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default FormatJSGallery;
