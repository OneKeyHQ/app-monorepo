import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  InfoItem,
  InfoItemGroup,
} from '../../views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { Token } from '../Token';

import type {
  ITxActionCommonDetailViewProps,
  ITxActionCommonListViewProps,
} from './types';

function TxActionCommonAvatar({
  avatar,
}: Pick<ITxActionCommonListViewProps, 'avatar' | 'tableLayout'>) {
  const containerSize = '$10';

  if (!avatar.src || typeof avatar.src === 'string') {
    return <Token size="lg" isNFT={avatar.isNFT} tokenImageUri={avatar.src} />;
  }

  return (
    <Stack
      w={containerSize}
      h={containerSize}
      alignItems="flex-end"
      justifyContent="flex-end"
    >
      <Stack position="absolute" left="$0" top="$0">
        <Token size="sm" isNFT={avatar.isNFT} tokenImageUri={avatar.src[0]} />
      </Stack>
      <Stack
        borderWidth={2}
        borderColor="$bgApp"
        borderRadius="$full"
        zIndex={1}
      >
        <Token size="sm" isNFT={avatar.isNFT} tokenImageUri={avatar.src[1]} />
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
      {description?.icon ? (
        <Icon
          color="$iconSubdued"
          mr="$0.5"
          size="$4"
          name={description.icon}
        />
      ) : null}
      <SizableText size="$bodyMd" color="$textSubdued">
        {description?.children}
      </SizableText>
    </XStack>
  );
}

function TxActionCommonChange({
  change,
  tableLayout,
}: Pick<ITxActionCommonListViewProps, 'tableLayout'> & { change: string }) {
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
}: {
  changeDescription: string;
}) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {changeDescription || '-'}
    </SizableText>
  );
}

function TxActionCommonFee({
  fee,
  feeFiatValue,
  feeSymbol,
  currencySymbol,
}: Pick<ITxActionCommonListViewProps, 'fee' | 'feeFiatValue' | 'feeSymbol'> & {
  currencySymbol: string;
}) {
  const intl = useIntl();

  return (
    <Stack flexGrow={1} flexBasis={0}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.swap_history_detail_network_fee,
        })}
      </SizableText>
      <XStack alignItems="center" space="$1">
        <NumberSizeableText
          size="$bodyMd"
          formatter="balance"
          formatterOptions={{ tokenSymbol: feeSymbol }}
        >
          {fee}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
        >
          {feeFiatValue}
        </NumberSizeableText>
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
    feeSymbol,
    timestamp,
    pending,
    tableLayout,
    showIcon,
    hideFeeInfo,
    ...rest
  } = props;
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

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
          {showIcon ? (
            <TxActionCommonAvatar avatar={avatar} tableLayout={tableLayout} />
          ) : null}
          <Stack>
            <TxActionCommonTitle title={title} tableLayout={tableLayout} />
            <XStack>
              {tableLayout && timestamp ? (
                <>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {formatTime(new Date(timestamp), {
                      hideSeconds: true,
                    })}
                  </SizableText>
                  {description && description.children ? (
                    <SizableText size="$bodyMd" color="$textSubdued" mx="$1">
                      •
                    </SizableText>
                  ) : null}
                </>
              ) : null}
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
          {typeof change === 'string' ? (
            <TxActionCommonChange change={change} tableLayout={tableLayout} />
          ) : (
            change
          )}
          {typeof changeDescription === 'string' ? (
            <TxActionCommonChangeDescription
              changeDescription={changeDescription}
            />
          ) : (
            changeDescription
          )}
        </Stack>
        {tableLayout && !hideFeeInfo ? (
          <TxActionCommonFee
            fee={fee}
            feeFiatValue={feeFiatValue}
            feeSymbol={feeSymbol}
            currencySymbol={currencySymbol}
          />
        ) : null}
      </XStack>

      {/* Actions */}
      {pending ? (
        <XStack pl={52} space="$3">
          <Button size="small" variant="primary">
            {intl.formatMessage({ id: ETranslations.global_speed_up })}
          </Button>
          <Button size="small">
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
        </XStack>
      ) : null}
    </ListItem>
  );
}

function TxActionCommonDetailView(props: ITxActionCommonDetailViewProps) {
  const { overview, target, source } = props;
  const intl = useIntl();
  return (
    <InfoItemGroup>
      <InfoItem
        label={overview.title}
        renderContent={
          <XStack alignItems="center" space="$3" minWidth={0}>
            <Token
              isNFT={overview.avatar?.isNFT}
              tokenImageUri={overview.avatar?.src}
            />
            <SizableText minWidth={0} maxWidth="$96" size="$bodyLgMedium">
              {overview.content}
            </SizableText>
          </XStack>
        }
      />

      {source && source.content ? (
        <InfoItem
          label={
            source.title ??
            intl.formatMessage({ id: ETranslations.content__from })
          }
          renderContent={source.content}
          description={source.description?.content}
        />
      ) : null}

      {target && target.content ? (
        <InfoItem
          label={
            target.title ??
            intl.formatMessage({ id: ETranslations.content__to })
          }
          renderContent={target.content}
          description={target.description?.content}
        />
      ) : null}
    </InfoItemGroup>
  );
}

export { TxActionCommonListView, TxActionCommonDetailView };
