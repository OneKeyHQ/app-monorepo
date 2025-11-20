/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Input,
  Select,
  SizableText,
  Stack,
  TextArea,
} from '@onekeyhq/components';
import {
  ONEKEY_API_HOST,
  ONEKEY_HEALTH_CHECK_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  DEFAULT_IP_TABLE_CONFIG,
  IP_TABLE_SPEED_TEST_TIMEOUT_MS,
} from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import {
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
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

type ISpeedTestType = 'domain' | 'ip';

// Extract preset options from DEFAULT_IP_TABLE_CONFIG
const PRESET_DOMAINS = Object.keys(DEFAULT_IP_TABLE_CONFIG.domains);

const PRESET_IPS = Array.from(
  new Set(
    Object.values(DEFAULT_IP_TABLE_CONFIG.domains).flatMap((domain) =>
      domain.endpoints.map((endpoint) => endpoint.ip),
    ),
  ),
);

const CUSTOM_VALUE = '__custom__';

const IpRequestGallery = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any | null>(null);
  const [error, setError] = useState<string>();

  // Speed test states
  const [speedTestType, setSpeedTestType] = useState<ISpeedTestType>('domain');
  const [domainPreset, setDomainPreset] = useState<string>(PRESET_DOMAINS[0]);
  const [ipPreset, setIpPreset] = useState<string>(PRESET_IPS[0]);
  const [customDomain, setCustomDomain] = useState('');
  const [customIp, setCustomIp] = useState('');
  const [sniHostnamePreset, setSniHostnamePreset] = useState<string>(
    PRESET_DOMAINS[0],
  );
  const [customSniHostname, setCustomSniHostname] = useState('');
  const [speedTestLoading, setSpeedTestLoading] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState<number | null>(null);
  const [speedTestError, setSpeedTestError] = useState<string>();

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

  const handleSpeedTest = useCallback(async () => {
    if (!isSupportIpTablePlatform()) {
      setSpeedTestError(
        'Speed test only works on native clients because @onekeyfe/react-native-sni-connect is a native module.',
      );
      return;
    }

    // Get actual values based on preset or custom input
    let actualTarget = '';
    if (speedTestType === 'domain') {
      actualTarget =
        domainPreset === CUSTOM_VALUE ? customDomain : domainPreset;
    } else {
      actualTarget = ipPreset === CUSTOM_VALUE ? customIp : ipPreset;
    }

    const actualSniHostname =
      sniHostnamePreset === CUSTOM_VALUE
        ? customSniHostname
        : sniHostnamePreset;

    if (!actualTarget.trim()) {
      setSpeedTestError('Please enter a domain or IP address');
      return;
    }

    if (speedTestType === 'ip' && !actualSniHostname.trim()) {
      setSpeedTestError('Please enter SNI hostname for IP testing');
      return;
    }

    setSpeedTestLoading(true);
    setSpeedTestError(undefined);
    setSpeedTestResult(null);

    try {
      let latency: number;

      if (speedTestType === 'domain') {
        // Test domain directly
        latency = await testDomainSpeed(
          actualTarget.trim(),
          ONEKEY_HEALTH_CHECK_URL,
          IP_TABLE_SPEED_TEST_TIMEOUT_MS,
        );
      } else {
        // Test IP with SNI
        latency = await testIpSpeed(
          actualTarget.trim(),
          actualSniHostname.trim(),
          ONEKEY_HEALTH_CHECK_URL,
          IP_TABLE_SPEED_TEST_TIMEOUT_MS,
        );
      }

      setSpeedTestResult(latency);
    } catch (err) {
      setSpeedTestError((err as Error).message ?? 'Speed test failed');
    } finally {
      setSpeedTestLoading(false);
    }
  }, [
    speedTestType,
    domainPreset,
    ipPreset,
    customDomain,
    customIp,
    sniHostnamePreset,
    customSniHostname,
  ]);

  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="IP Request"
      description="Send HTTP requests directly to an IP while preserving the SNI hostname. Useful for validating @onekeyfe/react-native-sni-connect integration."
      elements={[
        {
          title: 'Speed Test (Native Only)',
          element: (
            <Stack gap="$4">
              <Stack gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  Test Type
                </SizableText>
                <Select
                  title="Select Test Type"
                  value={speedTestType}
                  onChange={setSpeedTestType}
                  items={[
                    { label: 'Domain Test', value: 'domain' },
                    { label: 'IP + SNI Test', value: 'ip' },
                  ]}
                />
              </Stack>

              {speedTestType === 'domain' ? (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Select Domain
                  </SizableText>
                  <Select
                    title="Select Domain"
                    value={domainPreset}
                    onChange={setDomainPreset}
                    items={[
                      ...PRESET_DOMAINS.map((domain) => ({
                        label: domain,
                        value: domain,
                      })),
                      { label: 'Custom...', value: CUSTOM_VALUE },
                    ]}
                  />
                </Stack>
              ) : (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Select IP Address
                  </SizableText>
                  <Select
                    title="Select IP Address"
                    value={ipPreset}
                    onChange={setIpPreset}
                    items={[
                      ...PRESET_IPS.map((ip) => ({
                        label: ip,
                        value: ip,
                      })),
                      { label: 'Custom...', value: CUSTOM_VALUE },
                    ]}
                  />
                </Stack>
              )}

              {speedTestType === 'domain' && domainPreset === CUSTOM_VALUE ? (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Custom Domain
                  </SizableText>
                  <Input
                    value={customDomain}
                    onChangeText={setCustomDomain}
                    placeholder="Enter custom domain (e.g., wallet.onekey.so)"
                    autoCapitalize="none"
                  />
                </Stack>
              ) : null}

              {speedTestType === 'ip' && ipPreset === CUSTOM_VALUE ? (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Custom IP Address
                  </SizableText>
                  <Input
                    value={customIp}
                    onChangeText={setCustomIp}
                    placeholder="Enter custom IP (e.g., 216.19.4.106)"
                    autoCapitalize="none"
                  />
                </Stack>
              ) : null}

              {speedTestType === 'ip' ? (
                <>
                  <Stack gap="$2">
                    <SizableText size="$bodySm" color="$textSubdued">
                      Select SNI Hostname
                    </SizableText>
                    <Select
                      title="Select SNI Hostname"
                      value={sniHostnamePreset}
                      onChange={setSniHostnamePreset}
                      items={[
                        ...PRESET_DOMAINS.map((domain) => ({
                          label: domain,
                          value: domain,
                        })),
                        { label: 'Custom...', value: CUSTOM_VALUE },
                      ]}
                    />
                  </Stack>

                  {sniHostnamePreset === CUSTOM_VALUE ? (
                    <Stack gap="$2">
                      <SizableText size="$bodySm" color="$textSubdued">
                        Custom SNI Hostname
                      </SizableText>
                      <Input
                        value={customSniHostname}
                        onChangeText={setCustomSniHostname}
                        placeholder="Enter custom SNI hostname"
                        autoCapitalize="none"
                      />
                    </Stack>
                  ) : null}
                </>
              ) : null}

              {speedTestError ? (
                <SizableText color="$textCritical" size="$bodyMd">
                  {speedTestError}
                </SizableText>
              ) : null}

              <Button
                variant="primary"
                onPress={handleSpeedTest}
                loading={speedTestLoading}
                disabled={speedTestLoading}
              >
                Run Speed Test
              </Button>

              {speedTestResult !== null ? (
                <Stack gap="$2">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Test Result
                  </SizableText>
                  <Stack
                    padding="$3"
                    backgroundColor="$bgSubdued"
                    borderRadius="$2"
                  >
                    {speedTestResult === Infinity ? (
                      <SizableText color="$textCritical" size="$bodyLg">
                        Failed - Request timeout or unreachable
                      </SizableText>
                    ) : (
                      <SizableText color="$textSuccess" size="$bodyLg">
                        Latency: {speedTestResult.toFixed(2)} ms
                      </SizableText>
                    )}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          ),
        },
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
