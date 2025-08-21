import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

function demoLog(data: any, apiName: string) {
  Dialog.debugMessage({
    title: `API Response: ${apiName}`,
    debugMessage: data,
  });
  Toast.success({
    title: `${apiName} Success`,
    message: 'Check debug dialog for full response',
  });
  if (!platformEnv.isNative) {
    console.log('Hyperliquid API Response:', data);
  }
}

function demoError(error: unknown, apiName: string) {
  const e = error as Error;
  Dialog.debugMessage({
    title: `API Error: ${apiName}`,
    debugMessage: error,
  });
  Toast.error({
    title: 'API Error',
    message: e?.message || 'Unknown error',
  });
  if (!platformEnv.isNative) {
    console.error('Hyperliquid API Error:', error);
  }
}

export function PerpApiTests() {
  const [userAddress, setUserAddress] = useState(
    '0x1234567890123456789012345678901234567890',
  );
  const [builderAddress, setBuilderAddress] = useState(
    '0x9876543210987654321098765432109876543210',
  );
  const [startTime, setStartTime] = useState(
    String(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ); // 7 days ago
  const [endTime, setEndTime] = useState(String(Date.now()));

  // State for stored perp configuration
  const [storedBuilderAddress, setStoredBuilderAddress] = useState('');
  const [storedMaxBuilderFee, setStoredMaxBuilderFee] = useState('');
  const [newBuilderAddress, setNewBuilderAddress] = useState('');
  const [newMaxBuilderFee, setNewMaxBuilderFee] = useState('');

  // Load stored perp configuration
  const loadPerpConfig = async () => {
    try {
      const config = await backgroundApiProxy.simpleDb.perp.getPerpConfig();
      setStoredBuilderAddress(config.hyperliquidBuilderAddress || '');
      setStoredMaxBuilderFee(config.hyperliquidMaxBuilderFee?.toString() || '');
      setNewBuilderAddress(config.hyperliquidBuilderAddress || '');
      setNewMaxBuilderFee(config.hyperliquidMaxBuilderFee?.toString() || '');
    } catch (error) {
      console.error('Error loading perp config:', error);
    }
  };

  // Update stored perp configuration
  const updatePerpConfig = async () => {
    try {
      if (newBuilderAddress) {
        await backgroundApiProxy.serviceWebviewPerp.updatePerpConfig({
          address: newBuilderAddress,
        });
      }
      if (newMaxBuilderFee) {
        await backgroundApiProxy.serviceWebviewPerp.updatePerpConfig({
          fee: Number(newMaxBuilderFee),
        });
      }
      await loadPerpConfig(); // Reload to confirm changes
      Toast.success({
        title: 'Configuration Updated',
        message: 'Perp configuration has been updated successfully',
      });
    } catch (error) {
      const e = error as Error;
      Toast.error({
        title: 'Update Failed',
        message: e?.message || 'Failed to update configuration',
      });
    }
  };

  // Load configuration on component mount
  useEffect(() => {
    void loadPerpConfig();
  }, []);

  const handleApiCall = async (
    apiCall: () => Promise<unknown>,
    apiName: string,
  ) => {
    try {
      const result = await apiCall();
      demoLog({ api: apiName, result }, apiName);
    } catch (error) {
      demoError(error, apiName);
    }
  };

  return (
    <Stack gap="$4">
      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Perp Configuration (Stored Values)
        </SizableText>

        <Stack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            Current Stored Values:
          </SizableText>
          <XStack gap="$4">
            <Stack gap="$1">
              <SizableText size="$bodySm" fontWeight="500">
                Builder Address:
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {storedBuilderAddress || 'Not set'}
              </SizableText>
            </Stack>
            <Stack gap="$1">
              <SizableText size="$bodySm" fontWeight="500">
                Max Builder Fee:
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {storedMaxBuilderFee || 'Not set'}
              </SizableText>
            </Stack>
          </XStack>
        </Stack>

        <Stack gap="$2">
          <SizableText size="$bodySm" fontWeight="bold">
            Update Builder Address
          </SizableText>
          <Input
            value={newBuilderAddress}
            onChangeText={setNewBuilderAddress}
            placeholder="0x4EF880525383ab4E3d94b7689e3146bF899A296e"
            allowPaste
            allowClear
          />
        </Stack>

        <Stack gap="$2">
          <SizableText size="$bodySm" fontWeight="bold">
            Update Max Builder Fee
          </SizableText>
          <Input
            value={newMaxBuilderFee}
            onChangeText={setNewMaxBuilderFee}
            placeholder="58"
            keyboardType="numeric"
            allowPaste
            allowClear
          />
        </Stack>

        <XStack gap="$2">
          <Button onPress={updatePerpConfig} variant="primary">
            Update Configuration
          </Button>
          <Button onPress={loadPerpConfig} variant="secondary">
            Reload Current Values
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$2">
        <SizableText size="$bodySm" fontWeight="bold">
          User Address
        </SizableText>
        <Input
          value={userAddress}
          onChangeText={setUserAddress}
          placeholder="0x1234567890123456789012345678901234567890"
          allowPaste
          allowClear
        />
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Basic Account APIs
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getClearinghouseState({
                    userAddress,
                  }),
                'getClearinghouseState',
              )
            }
          >
            Get Clearinghouse State
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getSubAccounts({
                    userAddress,
                  }),
                'getSubAccounts',
              )
            }
          >
            Get Sub Accounts
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getAccountBalance({
                    userAddress,
                  }),
                'getAccountBalance',
              )
            }
          >
            Get Account Balance
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getOpenPositions({
                    userAddress,
                  }),
                'getOpenPositions',
              )
            }
          >
            Get Open Positions
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getAccountSummary({
                    userAddress,
                  }),
                'getAccountSummary',
              )
            }
          >
            Get Account Summary
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          History APIs
        </SizableText>

        <XStack gap="$2">
          <Stack flex={1} gap="$1">
            <SizableText size="$bodySm">Start Time (ms)</SizableText>
            <Input
              value={startTime}
              onChangeText={setStartTime}
              placeholder="Start timestamp"
              allowPaste
              allowClear
            />
          </Stack>

          <Stack flex={1} gap="$1">
            <SizableText size="$bodySm">End Time (ms)</SizableText>
            <Input
              value={endTime}
              onChangeText={setEndTime}
              placeholder="End timestamp"
              allowPaste
              allowClear
            />
          </Stack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getUserFunding({
                    userAddress,
                    startTime: Number(startTime),
                    endTime: Number(endTime),
                  }),
                'getUserFunding',
              )
            }
          >
            Get User Funding
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getUserNonFundingLedgerUpdates(
                    {
                      userAddress,
                      startTime: Number(startTime),
                      endTime: Number(endTime),
                    },
                  ),
                'getUserNonFundingLedgerUpdates',
              )
            }
          >
            Get Ledger Updates
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Vault APIs
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getUserVaultEquities({
                    userAddress,
                  }),
                'getUserVaultEquities',
              )
            }
          >
            Get Vault Equities
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Builder Fee APIs
        </SizableText>

        <Stack gap="$1">
          <SizableText size="$bodySm">Builder Address</SizableText>
          <Input
            value={builderAddress}
            onChangeText={setBuilderAddress}
            placeholder="0x9876543210987654321098765432109876543210"
            allowPaste
            allowClear
          />
        </Stack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getUserApprovedMaxBuilderFee(
                    {
                      userAddress,
                      builderAddress,
                    },
                  ),
                'getMaxBuilderFee',
              )
            }
          >
            Get Max Builder Fee
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.createApproveBuilderFeePayload(
                    {
                      builderAddress,
                      maxFeeRate: '0.025%',
                      chainId: '0xa4b1',
                    },
                  ),
                'createApproveBuilderFeePayload',
              )
            }
          >
            Create Builder Fee Payload
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceWebviewPerp.getUserBuilderFeeStatus(
                    {
                      userAddress,
                    },
                  ),
                'getUserBuilderFeeStatus',
              )
            }
            variant="secondary"
          >
            Get Builder Fee Status (Uses Stored Config)
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Transaction APIs
        </SizableText>

        <Stack gap="$1">
          <SizableText size="$bodySm">
            Note: Actual transaction signing requires wallet connection
          </SizableText>
        </Stack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Quick Test Buttons
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant="secondary"
            onPress={() => {
              setUserAddress('0x1234567890123456789012345678901234567890');
              setBuilderAddress('0x9876543210987654321098765432109876543210');
              setStartTime(String(Date.now() - 7 * 24 * 60 * 60 * 1000));
              setEndTime(String(Date.now()));
              Toast.success({ title: 'Reset to default values' });
            }}
          >
            Reset to Defaults
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              setStartTime(String(Date.now() - 24 * 60 * 60 * 1000)); // 1 day ago
              setEndTime(String(Date.now()));
              Toast.success({ title: 'Set to last 24 hours' });
            }}
          >
            Last 24h
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              setStartTime(String(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
              setEndTime(String(Date.now()));
              Toast.success({ title: 'Set to last 7 days' });
            }}
          >
            Last 7d
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

const PerpGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="PerpGallery"
    elements={[
      {
        title: 'Hyperliquid API Test 2862',
        element: <PerpApiTests />,
      },
    ]}
  />
);

export default PerpGallery;
