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
    <Stack mt="auto" pt="$10" maxWidth="$96">
      <Stack p="$3" borderRadius="$full" bg="$bgInfo" alignSelf="flex-start">
        <Icon name="EducationOutline" color="$iconInfo" />
      </Stack>

      {list.map(({ title, description }) => (
        <Stack key={title} mt="$5">
          <Heading size="$headingMd">{title}</Heading>
          <SizableText mt="$1.5" color="$textSubdued">
            {description}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}
