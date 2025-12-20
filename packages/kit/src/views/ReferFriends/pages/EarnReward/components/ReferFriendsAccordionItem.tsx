import type { ComponentProps, ReactNode } from 'react';

import { Accordion, Icon, SizableText, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

interface IReferFriendsAccordionItemProps {
  value: string;
  accountAddress: string;
  fiatValue: string;
  children: ReactNode;
  contentProps?: ComponentProps<typeof Accordion.Content>;
}

export function ReferFriendsAccordionItem({
  value,
  accountAddress,
  fiatValue,
  children,
  contentProps,
}: IReferFriendsAccordionItemProps) {
  const mergedContentProps: ComponentProps<typeof Accordion.Content> = {
    pt: '$2',
    pb: '$5',
    ...contentProps,
  };
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        borderWidth={0}
        bg="$transparent"
        px="$2"
        mx="$-2"
        py="$2.5"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        borderRadius="$2"
      >
        {({ open }: { open: boolean }) => (
          <XStack jc="space-between" flex={1} ai="center" gap="$3">
            <SizableText
              textAlign="left"
              flex={1}
              size="$bodyLgMedium"
              color="$text"
            >
              {accountUtils.shortenAddress({
                address: accountAddress,
                leadingLength: 6,
                trailingLength: 4,
              })}
            </SizableText>
            <XStack ai="center" gap="$2">
              <Currency
                color="$textSuccess"
                formatter="value"
                size="$bodyLgMedium"
                formatterOptions={{
                  showPlusMinusSigns: true,
                }}
              >
                {fiatValue}
              </Currency>
              <Icon
                size="$5"
                name={
                  open ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
                }
                color="$iconSubdued"
              />
            </XStack>
          </XStack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          unstyled
          animation="100ms"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          {...mergedContentProps}
        >
          {children}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}
