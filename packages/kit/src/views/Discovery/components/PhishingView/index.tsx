import { useMemo } from 'react';

import {
  Button,
  Icon,
  Stack,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';

function PhishingView({ onCloseTab }: { onCloseTab: () => void }) {
  const content = useMemo(
    () => (
      <YStack
        flex={1}
        bg="$bgCriticalStrong"
        justifyContent="center"
        alignItems="center"
      >
        <YStack maxWidth="$96" p="$6" borderRadius="$6" bg="$bg">
          <Icon name="InfoCircleOutline" size="$16" color="$iconCritical" />
          <Text mt="$6" variant="$heading4xl">
            Malicious DApp
          </Text>
          <Text variant="$bodyLg" py="$2">
            Potential risks
          </Text>
          <XStack alignItems="center" px="$1" mb="$2" space="$3">
            <Stack h="$1.5" w="$1.5" borderRadius="$full" bg="$textSubdued" />
            <Text>Theft of recovery phrase or password</Text>
          </XStack>
          <XStack alignItems="center" px="$1" mb="$2" space="$3">
            <Stack h="$1.5" w="$1.5" borderRadius="$full" bg="$textSubdued" />
            <Text>Phishing attacks</Text>
          </XStack>
          <XStack alignItems="center" px="$1" space="$3">
            <Stack h="$1.5" w="$1.5" borderRadius="$full" bg="$textSubdued" />
            <Text>Fake tokens or scams</Text>
          </XStack>
          <Button variant="primary" size="large" my="$6" onPress={onCloseTab}>
            Close Tab
          </Button>
        </YStack>
      </YStack>
    ),
    [onCloseTab],
  );
  return content;
}

export default PhishingView;
