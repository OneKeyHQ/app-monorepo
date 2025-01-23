import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Accordion, Icon, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  children: React.ReactNode;
};

function AdvancedSettings(props: IProps) {
  const { children } = props;
  const intl = useIntl();
  return (
    <YStack
      pt="$5"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <Accordion type="multiple" collapsable>
        <Accordion.Item value="advance">
          <Accordion.Trigger
            unstyled
            flexDirection="row"
            alignItems="center"
            alignSelf="flex-start"
            px="$1"
            mx="$-1"
            borderWidth={0}
            bg="$transparent"
            userSelect="none"
            borderRadius="$1"
            hoverStyle={{
              bg: '$bgSubdued',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: 0,
            }}
          >
            {({ open }: { open: boolean }) => (
              <>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_advanced_settings,
                  })}
                </SizableText>
                <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$5"
                  />
                </YStack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              unstyled
              animation="quick"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
              pt="$5"
            >
              {children}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

export { AdvancedSettings };
