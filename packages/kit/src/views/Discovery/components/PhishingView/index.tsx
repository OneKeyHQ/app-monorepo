import { useMemo } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Text,
  UnOrderedList,
  YStack,
} from '@onekeyhq/components';

function PhishingView({ onCloseTab }: { onCloseTab: () => void }) {
  const content = useMemo(
    () => (
      <YStack
        fullscreen
        bg="$bgCriticalStrong"
        justifyContent="center"
        alignItems="center"
        animation="quick"
        enterStyle={{
          opacity: 0,
        }}
      >
        <YStack
          w="100%"
          maxWidth="$96"
          p="$5"
          animation="quick"
          enterStyle={{
            scale: 0.95,
          }}
          borderRadius="$6"
          bg="$bg"
          elevation={20}
          outlineColor="$borderCritical"
          outlineWidth={1}
          outlineStyle="solid"
          overflow="hidden"
        >
          <YStack
            p="$3"
            bg="$bgCritical"
            borderRadius="$full"
            alignSelf="flex-start"
          >
            <Icon name="InfoCircleOutline" size="$8" color="$iconCritical" />
          </YStack>
          <Text mt="$3" variant="$headingXl">
            Malicious DApp
          </Text>
          <Text variant="$bodyLg" py="$2">
            Potential risks:
          </Text>
          <UnOrderedList>
            <UnOrderedList.Item>
              Theft of recovery phrase or password
            </UnOrderedList.Item>
            <UnOrderedList.Item>Phishing attacks</UnOrderedList.Item>
            <UnOrderedList.Item>Fake tokens or scams</UnOrderedList.Item>
          </UnOrderedList>
          <Text mt="$2" color="$textSubdued">
            If you understand the risks and want to proceed, you can{' '}
            <Button
              px="$1"
              py="$0"
              mx="$-1"
              my="$-px"
              display="inline-flex"
              variant="tertiary"
            >
              continue to the site
            </Button>
            .
          </Text>
          <Button
            mt="$5"
            variant="primary"
            size="large"
            $gtMd={
              {
                size: 'medium',
              } as IButtonProps
            }
            onPress={onCloseTab}
          >
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
