import { Heading, Icon, SizableText, Stack } from '@onekeyhq/components';

interface IListItem {
  title?: string;
  description?: string;
}

interface ITutorials {
  list: IListItem[];
}

export function Tutorials({ list }: ITutorials) {
  return (
    <Stack>
      {list.map(({ title, description }, index) => (
        <Stack
          key={title}
          {...(index !== 0 && {
            mt: '$5',
          })}
        >
          <Heading size="$headingMd">{title}</Heading>
          <SizableText mt="$1.5" color="$textSubdued">
            {description}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}
