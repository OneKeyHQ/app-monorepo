import type { ReactNode } from 'react';

import { Accordion, Icon, Stack } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';

type IFAQAccordionProps<T> = {
  items?: T[];
  defaultValue?: string[];
  getItemKey?: (item: T, index: number) => string;
  renderTitle: (item: T, options: { open: boolean }) => ReactNode;
  renderContent: (item: T) => ReactNode;
};

export function FAQAccordion<T>({
  items,
  defaultValue,
  getItemKey,
  renderTitle,
  renderContent,
}: IFAQAccordionProps<T>) {
  if (!items?.length) {
    return null;
  }

  return (
    <Accordion type="multiple" gap="$2" defaultValue={defaultValue}>
      {items.map((item, index) => {
        const itemKey = getItemKey?.(item, index) ?? String(index);
        return (
          <Accordion.Item value={itemKey} key={itemKey}>
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              borderWidth={0}
              bg="$transparent"
              px="$2"
              py="$1"
              mx="$-2"
              my="$-1"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              borderRadius="$2"
            >
              {({ open }: { open: boolean }) => (
                <>
                  {renderTitle(item, { open })}
                  <Stack
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_TRANSFORM}
                    rotate={open ? '180deg' : '0deg'}
                  >
                    <Icon
                      name="ChevronDownSmallOutline"
                      color={open ? '$iconActive' : '$iconSubdued'}
                      size="$5"
                    />
                  </Stack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick" overflow="hidden">
              <Accordion.Content
                unstyled
                pt="$2"
                pb="$5"
                animation="100ms"
                animateOnly={ANIMATE_ONLY_OPACITY}
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
              >
                {renderContent(item)}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
