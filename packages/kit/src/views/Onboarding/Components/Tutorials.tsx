import type { IStackProps } from '@onekeyhq/components';
import { Heading, SizableText, Stack } from '@onekeyhq/components';

interface IListItem {
  title?: string;
  description?: string;
}

interface ITutorials {
  list: IListItem[];
}

export function Tutorials({ list, ...rest }: ITutorials & IStackProps) {
  return (
    <Stack mt="$10" {...rest}>
      {list.map(({ title, description }, index) => (
        <Stack
          key={title}
          {...(index !== 0 && {
            mt: '$5',
          })}
        >
          <Heading size="$bodyMdMedium">{title}</Heading>
          <SizableText size="$bodyMd" mt="$1.5" color="$textSubdued">
            {description}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}
