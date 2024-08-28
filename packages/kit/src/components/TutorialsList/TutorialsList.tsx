import type { ComponentProps } from 'react';

import { SizableText, Stack, XStack } from '@onekeyhq/components';

export type ITutorialsListItem = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};
export function TutorialsList({
  tutorials,
  ...props
}: {
  tutorials: ITutorialsListItem[];
} & ComponentProps<typeof Stack>) {
  return (
    <Stack role="list" gap="$4" {...props}>
      {tutorials.map((item, index) => (
        <XStack key={index} role="listitem">
          <Stack
            borderRadius="$full"
            w="$6"
            h="$6"
            justifyContent="center"
            alignItems="center"
            bg="$bgInfo"
            mr="$3"
          >
            <SizableText size="$bodyMd" color="$textInfo">
              {index + 1}
            </SizableText>
          </Stack>
          <Stack flex={1} alignItems="flex-start">
            <SizableText size={item.description ? '$headingMd' : '$bodyLg'}>
              {item.title}
            </SizableText>
            {item.description ? (
              <SizableText>{item.description}</SizableText>
            ) : null}
            {item.children}
          </Stack>
        </XStack>
      ))}
    </Stack>
  );
}
