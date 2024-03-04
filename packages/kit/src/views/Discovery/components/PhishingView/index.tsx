import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  UnOrderedList,
  YStack,
} from '@onekeyhq/components';

function PhishingView({
  onCloseTab,
  onContinue,
}: {
  onCloseTab: () => void;
  onContinue: () => void;
}) {
  const intl = useIntl();
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
          <SizableText mt="$3" size="$headingXl">
            {intl.formatMessage({ id: 'content__dapp_potential_risk' })}
          </SizableText>
          <SizableText size="$bodyLg" py="$2">
            {intl.formatMessage({ id: 'content__dapp_potential_risk_li_1' })}
          </SizableText>
          <UnOrderedList>
            <UnOrderedList.Item>
              {intl.formatMessage({ id: 'content__dapp_potential_risk_li_2' })}
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              {intl.formatMessage({ id: 'content__dapp_potential_risk_li_3' })}
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              {intl.formatMessage({ id: 'content__dapp_potential_risk_li_4' })}
            </UnOrderedList.Item>
          </UnOrderedList>
          <SizableText mt="$2" color="$textSubdued">
            {intl.formatMessage({
              id: 'content__dapp_potential_risk_continue',
            })}
            <Button
              px="$1"
              py="$0"
              mx="$-1"
              my="$-px"
              display="inline-flex"
              variant="tertiary"
              onPress={onContinue}
            >
              continue to the site
            </Button>
            .
          </SizableText>
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
            {intl.formatMessage({ id: 'form__close_tab' })}
          </Button>
        </YStack>
      </YStack>
    ),
    [onCloseTab, onContinue, intl],
  );
  return content;
}

export default PhishingView;
