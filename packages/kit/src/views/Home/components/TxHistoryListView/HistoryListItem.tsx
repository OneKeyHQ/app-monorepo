import type { IKeyOfIcons, IListItemProps } from '@onekeyhq/components';
import {
  Icon,
  ListItem,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

export type IHistoryListItemProps = {
  avatar: {
    circular?: boolean;
    src?: string | string[];
    fallbackIcon: IKeyOfIcons;
  };
  title: string;
  description?: {
    prefix?: string;
    icon?: IKeyOfIcons;
    children?: string;
  };
  change?: string;
  changeDescription?: string;
  tableLayout?: boolean;
};

function HistoryListItemAvatar({
  avatar,
  tableLayout,
}: Pick<IHistoryListItemProps, 'avatar' | 'tableLayout'>) {
  const icon = avatar?.fallbackIcon;
  const containerSize = tableLayout ? '$8' : '$10';
  const borderRadius = avatar.circular ? '$full' : '$2';

  if (!avatar?.src) {
    return (
      <Stack
        w={containerSize}
        h={containerSize}
        bg="$bgStrong"
        alignItems="center"
        justifyContent="center"
        borderRadius={borderRadius}
      >
        <Icon name={icon} color="$iconSubdued" />
      </Stack>
    );
  }

  if (typeof avatar?.src === 'string') {
    return (
      <ListItem.Avatar
        src={avatar.src}
        size={containerSize}
        circular={avatar.circular}
        fallbackProps={{
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name={icon} color="$iconSubdued" />,
        }}
      />
    );
  }

  return (
    <Stack
      w={containerSize}
      h={containerSize}
      alignItems="flex-end"
      justifyContent="flex-end"
    >
      <Stack position="absolute" left="$0" top="$0">
        <ListItem.Avatar
          src={avatar.src[0]}
          size={tableLayout ? '$5' : '$6'}
          circular={avatar.circular}
          fallbackProps={{
            bg: '$bgStrong',
            justifyContent: 'center',
            alignItems: 'center',
            children: <Icon name={icon} color="$iconSubdued" />,
          }}
        />
      </Stack>
      <Stack
        borderWidth={2}
        borderColor="$bgApp"
        borderRadius={borderRadius}
        zIndex={1}
      >
        <ListItem.Avatar
          src={avatar.src[1]}
          size={tableLayout ? 22 : '$7'}
          circular={avatar.circular}
          fallbackProps={{
            bg: '$bgStrong',
            justifyContent: 'center',
            alignItems: 'center',
            children: <Icon name={icon} color="$iconSubdued" />,
          }}
        />
      </Stack>
    </Stack>
  );
}

function HistoryListItemTitle({
  title,
  tableLayout,
}: Pick<IHistoryListItemProps, 'title' | 'tableLayout'>) {
  return (
    <SizableText
      numberOfLines={1}
      size="$bodyLgMedium"
      {...(tableLayout && {
        w: '$40',
        $gtXl: {
          w: '$56',
        },
      })}
    >
      {title}
    </SizableText>
  );
}

function HistoryListItemDescription({
  description,
  tableLayout,
}: Pick<IHistoryListItemProps, 'description' | 'tableLayout'>) {
  return (
    <XStack alignItems="center">
      {description?.prefix && (
        <SizableText
          size={tableLayout ? '$bodyLg' : '$bodyMd'}
          color="$textSubdued"
          pr="$1.5"
        >
          {description?.prefix}
        </SizableText>
      )}
      {description?.icon && (
        <Icon
          color="$iconSubdued"
          mr="$0.5"
          size={tableLayout ? '$4.5' : '$4'}
          name={description.icon}
        />
      )}
      <SizableText
        size={tableLayout ? '$bodyLg' : '$bodyMd'}
        color="$textSubdued"
      >
        {description?.children || '-'}
      </SizableText>
    </XStack>
  );
}

function HistoryListItemChange({
  change,
  tableLayout,
}: Pick<IHistoryListItemProps, 'change' | 'tableLayout'>) {
  return (
    <SizableText
      size="$bodyLgMedium"
      textAlign="right"
      {...(change?.includes('+') && {
        color: '$textSuccess',
      })}
      {...(tableLayout && {
        w: '$40',
        $gtXl: {
          w: '$56',
        },
      })}
    >
      {change}
    </SizableText>
  );
}

function HistoryListItemChangeDescription({
  changeDescription,
  tableLayout,
}: Pick<IHistoryListItemProps, 'changeDescription' | 'tableLayout'>) {
  return (
    <SizableText
      size="$bodyMd"
      color="$textSubdued"
      textAlign="right"
      numberOfLines={1}
      {...(!changeDescription && {
        opacity: 0,
      })}
      {...(tableLayout && {
        size: '$bodyLg',
        w: '$48',
      })}
    >
      {changeDescription || '-'}
    </SizableText>
  );
}

export function HistoryListItem({
  avatar,
  title,
  description,
  change,
  changeDescription,
  tableLayout,
  ...rest
}: IHistoryListItemProps & IListItemProps) {
  return (
    <ListItem userSelect="none" {...rest}>
      <HistoryListItemAvatar avatar={avatar} tableLayout={tableLayout} />
      <Stack
        flex={1}
        {...(tableLayout && {
          flexDirection: 'row',
          space: '$3',
        })}
      >
        <HistoryListItemTitle title={title} tableLayout={tableLayout} />
        <HistoryListItemDescription
          description={description}
          tableLayout={tableLayout}
        />
      </Stack>
      <Stack
        {...(tableLayout && {
          flexDirection: 'row-reverse',
          space: '$3',
        })}
      >
        <HistoryListItemChange change={change} tableLayout={tableLayout} />
        <HistoryListItemChangeDescription
          changeDescription={changeDescription}
          tableLayout={tableLayout}
        />
      </Stack>
    </ListItem>
  );
}
