import { StyleSheet } from 'react-native';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
} from '@onekeyhq/components';

export const Card = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <Stack bg="$bgApp" overflow="hidden">
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        collapsible
        defaultValue=""
        borderRadius="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        backgroundColor="transparent"
      >
        <Accordion.Item value="a1">
          <Accordion.Trigger
            flexDirection="row"
            justifyContent="space-between"
            px="$5"
            py="$3"
            bg="$bgSubdued"
            borderWidth={0}
          >
            {({ open }: { open: boolean }) => (
              <XStack
                flex={1}
                justifyContent="space-between"
                alignItems="center"
              >
                <SizableText size="$headingMd" color="$textText">
                  {title}
                </SizableText>
                <View
                  animation="quick"
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$6"
                  />
                </View>
              </XStack>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              animation="quick"
              exitStyle={{ opacity: 0 }}
              px="0"
              py="$2"
            >
              {children}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
};
