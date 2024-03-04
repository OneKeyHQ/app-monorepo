import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
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
          borderRadius="$full"
          size="$7"
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
        borderRadius="$full"
        zIndex={1}
      >
        <ListItem.Avatar
          src={avatar.src[1]}
          size="$7"
          borderRadius="$full"
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
      numberOfLines={1}
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
    <Stack flexGrow={1} flexBasis={0}>
      <SizableText size="$bodyMd" color="$textSubdued">
        Gas Fee
      </SizableText>
      <XStack alignItems="center" space="$1">
        <SizableText size="$bodyMd">{fee}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {feeFiatValue}
        </SizableText>
      </XStack>
    </Stack>
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
    <ListItem
      space="$2"
      flexDirection="column"
      alignItems="flex-start"
      userSelect="none"
      {...rest}
    >
      {/* Content */}
      <XStack space="$3" alignSelf="stretch">
        <XStack
          space="$3"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 1,
          })}
        >
          <TxActionCommonAvatar avatar={avatar} tableLayout={tableLayout} />
          <Stack>
            <TxActionCommonTitle title={title} tableLayout={tableLayout} />
            <XStack>
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
          </Stack>
        </XStack>
        <Stack
          flexGrow={1}
          flexBasis={0}
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
        </Stack>
        {tableLayout && (
          <TxActionCommonFee fee={fee} feeFiatValue={feeFiatValue} />
        )}
      </XStack>

      {/* Actions */}
      {pending && (
        <XStack pl={52} space="$3">
          <Button size="small" variant="primary">
            Speed Up
          </Button>
          <Button size="small">Cancel</Button>
        </XStack>
      )}
    </ListItem>
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
