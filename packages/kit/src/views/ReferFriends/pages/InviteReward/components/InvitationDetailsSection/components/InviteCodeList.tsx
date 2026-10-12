import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ReferFriendsTestIDs } from '@onekeyhq/kit/src/views/ReferFriends/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteCodeListItem,
  IInviteCodeListResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  INVITE_CARD_BORDER_COLOR,
  useInviteListCardStyle,
} from '../../useInviteCardStyle';

import { CopyLinkSplitButton } from './CopyLinkSplitButton';
import { EditCodeDialogContent } from './EditCodeDialogContent';

type IOnCodeUpdated = () => Promise<void> | void;

function InviteCodeRow({
  item,
  isFirst,
  onUpdated,
}: {
  item: IInviteCodeListItem;
  isFirst: boolean;
  onUpdated: IOnCodeUpdated;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const { copyText } = useClipboard();

  const openEditDialog = useCallback(() => {
    Dialog.show({
      icon: 'GiftOutline',
      title: intl.formatMessage({
        id: ETranslations.referral_edit_referral_code_title,
      }),
      renderContent: (
        <EditCodeDialogContent
          code={item.code}
          note={item.note}
          isCustomCode={item.isCustomCode}
          onUpdated={onUpdated}
        />
      ),
      showFooter: false,
    });
  }, [intl, item, onUpdated]);

  const editButton = (
    <IconButton
      testID={ReferFriendsTestIDs.codeCellEditBtn}
      variant="tertiary"
      size="small"
      icon="PencilOutline"
      title={intl.formatMessage({
        id: ETranslations.referral_edit_referral_code_title,
      })}
      onPress={openEditDialog}
    />
  );
  const copyLinkButton = <CopyLinkSplitButton url={item.inviteUrl} />;

  const header = (
    <XStack ai="center" gap="$1.5">
      <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
        {item.code}
      </SizableText>
      <IconButton
        testID={ReferFriendsTestIDs.codeCellCopyBtn}
        variant="tertiary"
        size="small"
        icon="Copy3Outline"
        title={intl.formatMessage({ id: ETranslations.global_copy })}
        onPress={() => {
          void copyText(item.code);
        }}
      />
      {item.isPrimary ? (
        // The invite page shows this code.
        <Badge badgeType="default" badgeSize="sm">
          {intl.formatMessage({
            id: ETranslations.referral_code_default__title,
          })}
        </Badge>
      ) : null}
    </XStack>
  );
  const note = item.note ? (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {item.note}
    </SizableText>
  ) : null;
  const createdAt = (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {intl.formatMessage(
        { id: ETranslations.referral_code_created__desc },
        { date: formatDate(item.createdAt, { hideTimeForever: true }) },
      )}
    </SizableText>
  );
  // What the code brought in, as equal columns of a label over its figure,
  // so codes compare at a glance down the list.
  const stats = (
    <XStack gap="$4">
      {[
        {
          label: ETranslations.referral_code_list_sales,
          value: (
            <SizableText size="$bodyMdMedium">{item.salesOrders}</SizableText>
          ),
        },
        {
          label: ETranslations.referral_code_list_wallets,
          value: (
            <SizableText size="$bodyMdMedium">
              {item.onchainWallets}
            </SizableText>
          ),
        },
        {
          label: ETranslations.referral_order_reward,
          value: (
            <Currency
              size="$bodyMdMedium"
              formatter="value"
              numberOfLines={1}
            >
              {item.cumulativeRewardsFiatValue}
            </Currency>
          ),
        },
      ].map((stat) => (
        <YStack key={stat.label} flex={1} flexBasis={0} minWidth={0} gap="$0.5">
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {intl.formatMessage({ id: stat.label })}
          </SizableText>
          {stat.value}
        </YStack>
      ))}
    </XStack>
  );

  if (md) {
    // Compact rows stack: the code with its edit action, the figures, then
    // the date with the link action, which share one line.
    return (
      <YStack
        gap="$3"
        py="$3.5"
        borderTopWidth={isFirst ? 0 : 1}
        borderColor={INVITE_CARD_BORDER_COLOR}
      >
        <YStack gap="$1">
          <XStack ai="center" gap="$3">
            <XStack flex={1} minWidth={0}>
              {header}
            </XStack>
            {editButton}
          </XStack>
          {note}
        </YStack>
        {stats}
        <XStack ai="center" jc="space-between" gap="$3">
          {createdAt}
          {copyLinkButton}
        </XStack>
      </YStack>
    );
  }

  // Wide rows read across: the code with its note and date, the figures,
  // then both actions. Zero flex bases keep the columns the same width on
  // every row, so a long code or note truncates instead of shifting the
  // figures or pushing the actions out of view.
  return (
    <XStack
      ai="center"
      gap="$6"
      py="$3.5"
      borderTopWidth={isFirst ? 0 : 1}
      borderColor={INVITE_CARD_BORDER_COLOR}
    >
      <YStack flex={1} flexBasis={0} minWidth={0} gap="$1">
        {header}
        {note}
        {createdAt}
      </YStack>
      <YStack flex={1.4} flexBasis={0} minWidth={0}>
        {stats}
      </YStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {copyLinkButton}
        {editButton}
      </XStack>
    </XStack>
  );
}

export function InviteCodeList({
  codeListData,
  isLoading,
  onCodeUpdated,
}: {
  codeListData: IInviteCodeListResponse | undefined;
  isLoading: boolean;
  onCodeUpdated: IOnCodeUpdated;
}) {
  const intl = useIntl();
  const cardStyle = useInviteListCardStyle();
  // Primary code first, then newest first so a just-created code is on top.
  const items = useMemo(
    () =>
      (codeListData?.items ?? []).toSorted((a, b) => {
        if (a.isPrimary !== b.isPrimary) {
          return a.isPrimary ? -1 : 1;
        }
        return (
          (new Date(b.createdAt).getTime() || 0) -
          (new Date(a.createdAt).getTime() || 0)
        );
      }),
    [codeListData?.items],
  );

  if (!codeListData && isLoading) {
    return (
      <YStack gap="$3" py="$3">
        <Skeleton.HeadingSm />
        <Skeleton.BodyMd />
      </YStack>
    );
  }

  if (!codeListData || items.length === 0) {
    return (
      <Stack py="$8" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }

  return (
    <YStack>
      {/* Inset like the rows' text, so the page keeps one left edge. */}
      <SizableText size="$bodyMd" color="$textSubdued" px="$4" pb="$2">
        {codeListData.remainingCodes > 0
          ? intl.formatMessage(
              { id: ETranslations.referral_codes_remaining__desc },
              { count: codeListData.remainingCodes },
            )
          : intl.formatMessage(
              { id: ETranslations.referral_codes_used_up__desc },
              { max: codeListData.maxCodes },
            )}
      </SizableText>
      {/* The card holds the side padding, so the rows' hairlines stop at
          the text edge like the other cards' dividers. */}
      <YStack px="$4" overflow="hidden" {...cardStyle}>
        {items.map((item, index) => (
          <InviteCodeRow
            key={item.code}
            item={item}
            isFirst={index === 0}
            onUpdated={onCodeUpdated}
          />
        ))}
      </YStack>
    </YStack>
  );
}
