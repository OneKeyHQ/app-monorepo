import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { setStringAsync } from 'expo-clipboard';

import {
  Button,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList,
} from '@onekeyhq/shared/src/routes/discovery.desktop';

import type { RouteProp } from '@react-navigation/core';

export default function CustomInjectedE2EErrorDetailModal() {
  const route =
    useRoute<
      RouteProp<
        IDiscoveryModalParamList,
        EDiscoveryModalRoutes.CustomInjectedE2EErrorDetail
      >
    >();
  const { errorLog, protocolName } = route.params;
  const [copyStatus, setCopyStatus] = useState<{
    error: boolean;
    text: string;
  }>();

  const copyErrorLog = async () => {
    try {
      await setStringAsync(errorLog);
      setCopyStatus({ error: false, text: 'Copied' });
    } catch (error) {
      setCopyStatus({
        error: true,
        text: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <Page>
      <Page.Header title="E2E error details" />
      <Page.Body>
        <YStack flex={1} gap="$3" minHeight={0} px="$5" pb="$5">
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <YStack flex={1} minWidth={0}>
              <SizableText size="$headingSm">{protocolName}</SizableText>
              <SizableText color="$textSubdued" size="$bodySm">
                Latest validation error
              </SizableText>
            </YStack>
            <Button
              icon="Copy3Outline"
              size="small"
              testID="custom-injected-e2e-copy-error"
              variant="secondary"
              onPress={() => void copyErrorLog()}
            >
              Copy log
            </Button>
            {copyStatus ? (
              <SizableText
                color={copyStatus.error ? '$textCritical' : '$textSuccess'}
                size="$bodySm"
              >
                {copyStatus.text}
              </SizableText>
            ) : null}
          </XStack>
          <ScrollView
            bg="$bgSubdued"
            borderColor="$borderSubdued"
            borderRadius="$3"
            borderWidth={1}
            flex={1}
            maxHeight={480}
            minHeight={240}
            testID="custom-injected-e2e-error-log-scroll"
          >
            <SizableText
              color="$textSubdued"
              fontFamily="$monoRegular"
              p="$3"
              selectable
              size="$bodySm"
              testID="custom-injected-e2e-error-log"
              whiteSpace="pre-wrap"
            >
              {errorLog}
            </SizableText>
          </ScrollView>
        </YStack>
      </Page.Body>
    </Page>
  );
}
