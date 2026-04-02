import { StyleSheet } from 'react-native';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

const CARD_ACCORDION_VALUE = 'card';

export const Card = ({
  title,
  children,
  renderFilter,
  renderHeader,
}: {
  title: string;
  children: React.ReactNode;
  renderFilter?: React.ReactNode;
  /** Header content that remains visible when collapsed */
  renderHeader?: React.ReactNode;
}) => {
  return (
    <Stack bg="$bgApp" overflow="hidden">
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        collapsible
        defaultValue={CARD_ACCORDION_VALUE}
        borderRadius="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        backgroundColor="transparent"
      >
        <Accordion.Item value={CARD_ACCORDION_VALUE}>
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
                  animateOnly={ANIMATE_ONLY_TRANSFORM}
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
          {/* Header remains visible when collapsed */}
          {renderHeader}
          <Accordion.Content px="0" py="$2">
            {renderFilter ? (
              <Stack mt="$3" mb="$5" px="$5">
                {renderFilter}
              </Stack>
            ) : null}
            {children}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
};
