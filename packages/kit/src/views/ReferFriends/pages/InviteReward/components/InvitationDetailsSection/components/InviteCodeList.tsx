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

import { REFERRAL_USD_CURRENCY_PROPS } from '../../shared/getRewardSummary';
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

  const details = (
    <YStack flex={1} gap="$1" minWidth={0}>
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
        {md ? (
          <>
            <Stack flex={1} />
            {editButton}
          </>
        ) : null}
      </XStack>
      {item.note ? (
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {item.note}
        </SizableText>
      ) : null}
      {/* Separate text runs so a narrow row wraps between facts, not inside
          one. */}
      <XStack ai="center" columnGap="$1" flexWrap="wrap">
        {[
          intl.formatMessage(
            { id: ETranslations.referral_code_orders__desc },
            { count: item.salesOrders },
          ),
          intl.formatMessage(
            { id: ETranslations.referral_code_wallets__desc },
            { count: item.onchainWallets },
          ),
          intl.formatMessage(
            { id: ETranslations.referral_code_earned__desc },
            {
              amount: (
                <Currency
                  size="$bodySmMedium"
                  formatter="value"
                  // Reward figures are shown in USD across the referral pages.
                  targetCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
                >
                  {item.cumulativeRewardsFiatValue}
                </Currency>
              ),
            },
          ),
          intl.formatMessage(
            { id: ETranslations.referral_code_created__desc },
            { date: formatDate(item.createdAt, { hideTimeForever: true }) },
          ),
        ].map((fact, index) => (
          // oxlint-disable-next-line react/no-array-index-key
          <SizableText key={index} size="$bodySm" color="$textSubdued">
            {index > 0 ? '· ' : null}
            {fact}
          </SizableText>
        ))}
      </XStack>
    </YStack>
  );

  // Compact rows stack the link action under the details so the stats keep
  // the full row width; wide rows keep both actions on the right.
  return (
    <XStack
      ai="center"
      gap="$3"
      px="$4"
      py="$3.5"
      borderTopWidth={isFirst ? 0 : 1}
      borderColor={INVITE_CARD_BORDER_COLOR}
    >
      {md ? (
        <YStack flex={1} gap="$3" minWidth={0}>
          {details}
          <XStack>{copyLinkButton}</XStack>
        </YStack>
      ) : (
        <>
          {details}
          <XStack ai="center" gap="$2" flexShrink={0}>
            {copyLinkButton}
            {editButton}
          </XStack>
        </>
      )}
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
      <SizableText size="$bodyMd" color="$textSubdued" pb="$2">
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
      <YStack overflow="hidden" {...cardStyle}>
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
