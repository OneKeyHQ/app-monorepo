import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

import { Container } from '../Container';

import type {
  ITxActionCommonDetailViewProps,
  ITxActionCommonListViewProps,
} from './types';

function TxActionCommonAvatar({
  avatar,
  tableLayout,
}: Pick<ITxActionCommonListViewProps, 'avatar' | 'tableLayout'>) {
  const icon = avatar?.fallbackIcon;
  const containerSize = '$10';
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
}: Pick<ITxActionCommonListViewProps, 'title' | 'tableLayout'>) {
  return (
    <SizableText
      numberOfLines={1}
      size="$bodyLgMedium"
      textTransform="capitalize"
      {...(tableLayout && {
        size: '$bodyMdMedium',
      })}
    >
      {title}
    </SizableText>
  );
}

function TxActionCommonDescription({
  description,
}: Pick<ITxActionCommonListViewProps, 'description' | 'tableLayout'>) {
  return (
    <XStack alignItems="center">
      {description?.prefix ? (
        <SizableText size="$bodyMd" color="$textSubdued" pr="$1.5">
          {description?.prefix}
        </SizableText>
      ) : null}
      {description?.icon && (
        <Icon
          color="$iconSubdued"
          mr="$0.5"
          size="$4"
          name={description.icon}
        />
      )}
      <SizableText size="$bodyMd" color="$textSubdued">
        {description?.children || '-'}
      </SizableText>
    </XStack>
  );
}

function TxActionCommonChange({
  change,
  tableLayout,
}: Pick<ITxActionCommonListViewProps, 'change' | 'tableLayout'>) {
  return (
    <SizableText
      size="$bodyLgMedium"
      {...(change?.includes('+') && {
        color: '$textSuccess',
      })}
      {...(tableLayout && {
        size: '$bodyMdMedium',
      })}
    >
      {change}
    </SizableText>
  );
}

function TxActionCommonChangeDescription({
  changeDescription,
}: Pick<ITxActionCommonListViewProps, 'changeDescription' | 'tableLayout'>) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {changeDescription || '-'}
    </SizableText>
  );
}

function TxActionCommonFee({
  fee,
  feeFiatValue,
}: Pick<ITxActionCommonListViewProps, 'fee' | 'feeFiatValue'>) {
  return (
    <YStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        Gas Fee
      </SizableText>
      <XStack alignItems="center" space="$1">
        <SizableText size="$bodyMd">{fee}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {feeFiatValue}
        </SizableText>
      </XStack>
    </YStack>
  );
}

function TxActionCommonListView(
  props: ITxActionCommonListViewProps & IListItemProps,
) {
  const {
    avatar,
    title,
    description,
    change,
    changeDescription,
    fee,
    feeFiatValue,
    timestamp,
    pending,
    tableLayout,
    ...rest
  } = props;
  return (
    <Stack
      {...(tableLayout && {
        flexDirection: 'row',
      })}
    >
      <ListItem flex={1} userSelect="none" px="$0" {...rest}>
        <TxActionCommonAvatar avatar={avatar} tableLayout={tableLayout} />
        <XStack
          flex={1}
          alignItems="center"
          {...(tableLayout && {
            space: '$3',
          })}
        >
          <YStack flexBasis={tableLayout ? '33%' : '50%'}>
            <TxActionCommonTitle title={title} tableLayout={tableLayout} />
            <XStack alignItems="center">
              {tableLayout && timestamp && (
                <>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {formatTime(new Date(timestamp), {
                      hideSeconds: true,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued" mx="$1">
                    •
                  </SizableText>
                </>
              )}
              <TxActionCommonDescription
                description={description}
                tableLayout={tableLayout}
              />
            </XStack>
          </YStack>
          <YStack
            flexBasis={tableLayout ? '33%' : '50%'}
            alignItems="flex-end"
            {...(tableLayout && {
              alignItems: 'unset',
            })}
          >
            <TxActionCommonChange change={change} tableLayout={tableLayout} />
            {changeDescription && (
              <TxActionCommonChangeDescription
                changeDescription={changeDescription}
                tableLayout={tableLayout}
              />
            )}
          </YStack>
          {tableLayout && (
            <TxActionCommonFee fee={fee} feeFiatValue={feeFiatValue} />
          )}
        </XStack>
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

function TxActionCommonDetailView(props: ITxActionCommonDetailViewProps) {
  const { overview, target, source } = props;
  const intl = useIntl();
  return (
    <Container.Box>
      <Container.Item
        title={overview.title}
        content={
          <XStack alignItems="center" space="$1">
            <ListItem.Avatar
              src={overview.avatar?.fallbackIcon}
              size="$7"
              circular={overview.avatar?.circular}
              fallbackProps={{
                bg: '$bgStrong',
                justifyContent: 'center',
                alignItems: 'center',
                children: (
                  <Icon
                    name={
                      overview.avatar?.fallbackIcon ?? 'QuestionmarkOutline'
                    }
                    color="$iconSubdued"
                  />
                ),
              }}
            />
            <SizableText size="$headingLg">{overview.content}</SizableText>
          </XStack>
        }
      />
      {target && (
        <Container.Item
          title={target.title ?? intl.formatMessage({ id: 'content__to' })}
          content={target.content}
        />
      )}

      {source && (
        <Container.Item
          title={source.title ?? intl.formatMessage({ id: 'content__from' })}
          content={source.content}
        />
      )}
    </Container.Box>
  );
}

export { TxActionCommonListView, TxActionCommonDetailView };
