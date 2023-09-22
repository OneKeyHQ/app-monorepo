import { useMemo } from 'react';

import { Adapt, Sheet, Select as TMSelect } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

import { Icon } from '../Icon';
import { YStack } from '../Stack';

import type { SelectProps as TMSelectProps } from 'tamagui';

interface SelectProps extends TMSelectProps {
  data: Array<{ other?: any; name: string | number }>;
}

function Select({ data, ...props }: SelectProps) {
  return (
    <TMSelect {...props}>
      <TMSelect.Trigger
        unstyled
        borderRadius="$2"
        borderColor="$borderStrong"
        borderWidth="$px"
        paddingHorizontal="$3"
        paddingVertical="$1.5"
        backgroundColor="$transparent"
        width="$56"
        minHeight="auto"
      >
        <TMSelect.Value
          placeholder="Something"
          unstyled
          fontSize="$bodyLgMedium"
          fontWeight="$bodyLgMedium"
        />
        <Icon color="$iconSubdued" name="ChevronDownSmallOutline" />
      </TMSelect.Trigger>
      <Adapt when="md">
        <Sheet
          native={!!props.native}
          modal
          dismissOnSnapToBottom
          animationConfig={{
            type: 'spring',
            damping: 20,
            mass: 1.2,
            stiffness: 250,
          }}
        >
          <Sheet.Frame>
            <Sheet.ScrollView>
              <Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>

          <Sheet.Overlay
            animation="lazy"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
            backgroundColor="$bgBackdrop"
          />
        </Sheet>
      </Adapt>
      <TMSelect.Content zIndex={200000}>
        <TMSelect.ScrollUpButton
          alignItems="center"
          justifyContent="center"
          position="relative"
          width="100%"
          height="$3"
        >
          <YStack zIndex={10}>
            <Icon color="$iconSubdued" name="ChevronTopSmallOutline" />
          </YStack>

          <LinearGradient
            start={[0, 0]}
            end={[0, 1]}
            fullscreen
            colors={['$bg', '$transparent']}
            borderRadius="$3"
          />
        </TMSelect.ScrollUpButton>
        <TMSelect.Viewport
          // to do animations:
          // animation="quick"
          // animateOnly={['transform', 'opacity']}
          // enterStyle={{ o: 0, y: -10 }}
          // exitStyle={{ o: 0, y: 10 }}
          unstyled
          minWidth="$48"
          outlineWidth="$px"
          outlineColor="$borderSubdued"
          outlineStyle="solid"
          borderRadius="$3"
          overflow="hidden"
          elevate
          backgroundColor="$bg"
        >
          <TMSelect.Group>
            <TMSelect.Label fontSize="$headingMd" fontWeight="$headingMd">
              Fruits
            </TMSelect.Label>

            {/* for longer lists memoizing these is useful */}

            {useMemo(
              () =>
                data.map((item, i) => (
                  <TMSelect.Item
                    index={i}
                    key={item.name}
                    value={item.name.toLowerCase()}
                  >
                    <TMSelect.ItemText
                      unstyled
                      fontSize="$bodyLg"
                      fontWeight="$bodyLg"
                    >
                      {item.name}
                    </TMSelect.ItemText>

                    <TMSelect.ItemIndicator marginLeft="auto">
                      <Icon
                        name="CheckLargeOutline"
                        $md={{ size: '$5' }}
                        $gtMd={{ size: '$4' }}
                      />
                    </TMSelect.ItemIndicator>
                  </TMSelect.Item>
                )),

              [data],
            )}
          </TMSelect.Group>
        </TMSelect.Viewport>
        <TMSelect.ScrollDownButton
          alignItems="center"
          justifyContent="center"
          position="relative"
          width="100%"
          height="$3"
        >
          <YStack zIndex={10}>
            <Icon name="ChevronDownSmallOutline" color="$iconSubdued" />
          </YStack>

          <LinearGradient
            start={[0, 0]}
            end={[0, 1]}
            fullscreen
            colors={['$transparent', '$bg']}
            borderRadius="$3"
          />
        </TMSelect.ScrollDownButton>
      </TMSelect.Content>
    </TMSelect>
  );
}

Select.displayName = 'Select';
export { Select };
export type { SelectProps };
