/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { useCallback, useEffect, useState } from 'react';

import { Button, SizableText, Stack, TextArea } from '@onekeyhq/components';
import {
  sniRequest,
  subscribeToLogs,
} from '@onekeyhq/shared/src/request/helpers/sniRequest';
import { isSupportIpTablePlatform } from '@onekeyhq/shared/src/utils/ipTableUtils';

import { Layout } from './utils/Layout';

const HARD_CODED_REQUEST = {
  ip: '216.19.4.106',
  hostname: 'wallet.onekeytest.com',
  path: '/wallet/v1/account/validate-address?networkId=btc--0&accountAddress=bc1qezh467l5gwkk72v2dx6yj488hlpad8d34u6z2j',
  headers: {
    'X-Onekey-Request-ID': 'cc740bab-7cbb-412f-9d9a-1d7b515f601d',
    'X-Onekey-Request-Currency': 'usd',
    'X-Onekey-Request-Locale': 'zh-cn',
    'X-Onekey-Request-Theme': 'light',
    'X-Onekey-Request-Platform': 'android-apk',
    'X-Onekey-Request-Version': '5.16.0',
    'X-Onekey-Request-Build-Number': '2000000000',
    'X-Onekey-Request-Token': 'eyJhbGciOi...',
    'X-Onekey-Request-Currency-Value': '1.0',
    'X-Onekey-Instance-Id': '67848a28-b89c-4e0b-8c0f-b87824480d6a',
    'x-onekey-wallet-type': 'hd',
    'x-onekey-hide-asset-details': 'false',
  },
  method: 'GET',
  body: null,
  timeout: 5000,
};

const IpRequestGallery = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const unsubscribe = subscribeToLogs((log) => {
      console.log(
        `[sni-connect][${log.level}][${new Date(
          log.timestamp,
        ).toISOString()}]: ${log.message}`,
      );
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!isSupportIpTablePlatform()) {
      setError(
        'This demo only works on native clients because @onekeyfe/react-native-sni-connect is a native module.',
      );
      return;
    }
    setLoading(true);
    setError(undefined);
    setResponse(null);
    try {
      const result = await sniRequest(HARD_CODED_REQUEST);
      setResponse(result);
    } catch (err) {
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="IP Request"
      description="Send HTTP requests directly to an IP while preserving the SNI hostname. Useful for validating @onekeyfe/react-native-sni-connect integration."
      elements={[
        {
          title: 'Direct IP Request (Native Only)',
          element: (
            <Stack gap="$4">
              <Stack gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  Request Payload
                </SizableText>
                <TextArea
                  value={JSON.stringify(HARD_CODED_REQUEST, null, 2)}
                  editable={false}
                  multiline
                  numberOfLines={12}
                  autoCapitalize="none"
                />
              </Stack>
              {error ? (
                <SizableText color="$textCritical" size="$bodyMd">
                  {error}
                </SizableText>
              ) : null}
              <Button
                variant="primary"
                onPress={handleSend}
                loading={loading}
                disabled={loading}
              >
                Send Request
              </Button>
              {response ? (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Response
                  </SizableText>
                  <TextArea
                    value={JSON.stringify(response, null, 2)}
                    editable={false}
                    multiline
                    numberOfLines={14}
                    autoCapitalize="none"
                  />
                </Stack>
              ) : null}
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default IpRequestGallery;
