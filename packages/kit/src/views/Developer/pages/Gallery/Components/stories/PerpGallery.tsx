import { useState } from 'react';

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

function PerpApiTests() {
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
                  backgroundApiProxy.servicePerp.getClearinghouseState({
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
                  backgroundApiProxy.servicePerp.getSubAccounts({
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
                  backgroundApiProxy.servicePerp.getAccountBalance({
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
                  backgroundApiProxy.servicePerp.getOpenPositions({
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
                  backgroundApiProxy.servicePerp.getAccountSummary({
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
                  backgroundApiProxy.servicePerp.getUserFunding({
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
                  backgroundApiProxy.servicePerp.getUserNonFundingLedgerUpdates(
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
                  backgroundApiProxy.servicePerp.getUserVaultEquities({
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
                  backgroundApiProxy.servicePerp.getMaxBuilderFee({
                    userAddress,
                    builderAddress,
                  }),
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
                  backgroundApiProxy.servicePerp.createApproveBuilderFeePayload(
                    {
                      builderAddress,
                      maxFeeRate: '0.025%',
                      nonce: Date.now(),
                    },
                  ),
                'createApproveBuilderFeePayload',
              )
            }
          >
            Create Builder Fee Payload
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
        title: 'Hyperliquid API Test',
        element: <PerpApiTests />,
      },
    ]}
  />
);

export default PerpGallery;
