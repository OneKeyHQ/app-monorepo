import { isString } from 'lodash';

import type { IListItemProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Image,
  ListItem,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import type { ITxActionCommonProps } from './types';

function TxActionCommonAvatar({
  avatar,
  tableLayout,
}: Pick<ITxActionCommonProps, 'avatar' | 'tableLayout'>) {
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

function TxActionCommonTitle({
  title,
  tableLayout,
}: Pick<ITxActionCommonProps, 'title' | 'tableLayout'>) {
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

function TxActionCommonDescription({
  description,
  tableLayout,
}: Pick<ITxActionCommonProps, 'description' | 'tableLayout'>) {
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

function TxActionCommonChange({
  change,
  tableLayout,
}: Pick<ITxActionCommonProps, 'change' | 'tableLayout'>) {
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

function TxActionCommonChangeDescription({
  changeDescription,
  tableLayout,
}: Pick<ITxActionCommonProps, 'changeDescription' | 'tableLayout'>) {
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

function TxActionCommonT1(props: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  content?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const { title, icon, content, description } = props;
  return (
    <YStack space="$1" px="$4" py="$3">
      {isString(title) ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
      ) : (
        title
      )}
      <XStack space="$2" alignItems="center">
        {isString(icon) ? (
          <Image size="$8" circular>
            <Image.Source src={icon} />
            <Image.Fallback>
              <Icon name="ImageMountainSolid" size="$8" />
            </Image.Fallback>
          </Image>
        ) : (
          icon
        )}
        {isString(content) ? (
          <SizableText size="$headingXl">{content}</SizableText>
        ) : (
          content
        )}
      </XStack>
      {isString(description) ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      ) : (
        description
      )}
    </YStack>
  );
}

function TxActionCommonT0({
  avatar,
  title,
  description,
  change,
  changeDescription,
  pending,
  tableLayout,
  ...rest
}: ITxActionCommonProps & IListItemProps) {
  return (
    <Stack
      {...(tableLayout && {
        flexDirection: 'row',
      })}
    >
      <ListItem flex={1} userSelect="none" {...rest}>
        <TxActionCommonAvatar avatar={avatar} tableLayout={tableLayout} />
        <Stack
          flex={1}
          {...(tableLayout && {
            flexDirection: 'row',
            space: '$3',
          })}
        >
          <TxActionCommonTitle title={title} tableLayout={tableLayout} />
          <TxActionCommonDescription
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
          <TxActionCommonChange change={change} tableLayout={tableLayout} />
          <TxActionCommonChangeDescription
            changeDescription={changeDescription}
            tableLayout={tableLayout}
          />
        </Stack>
      </ListItem>
      {pending && (
        <XStack
          px="$5"
          space="$2.5"
          alignItems="center"
          {...(tableLayout
            ? {
                flexDirection: 'row-reverse',
              }
            : { pb: '$2.5', pl: 72 })}
        >
          <Button size="small" variant="primary">
            Speed Up
          </Button>
          <Button size="small" variant="tertiary" m="$0">
            Cancel
          </Button>
        </XStack>
      )}
    </Stack>
  );
}

export { TxActionCommonT0, TxActionCommonT1 };
