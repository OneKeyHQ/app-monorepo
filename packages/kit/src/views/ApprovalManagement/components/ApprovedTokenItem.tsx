import { type ReactNode, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ListItem } from '../../../components/ListItem';
import { useTokenMapAtom } from '../../../states/jotai/contexts/approvalList';
import { ApprovalManagementTestIDs } from '../testIDs';

import { useApprovalManagementContext } from './ApprovalManagementContext';

type IProps = {
  accountId: string;
  networkId: string;
  contractAddress: string;
  approval: IApproval;
  isSelectMode: boolean;
  onSelect: ({
    approval,
    isSelected,
  }: {
    approval: IApproval;
    isSelected: boolean;
  }) => Promise<void>;
  onRevoke: ({
    approval,
    tokenInfo,
  }: {
    approval: IApproval;
    tokenInfo: IToken;
  }) => Promise<void>;
};

function ApprovedTokenItem(props: IProps) {
  const {
    accountId,
    networkId,
    contractAddress,
    approval,
    isSelectMode,
    onRevoke,
    onSelect,
  } = props;

  const [{ tokenMap }] = useTokenMapAtom();
  const { isBuildingRevokeTxs, selectedTokens } =
    useApprovalManagementContext();
  const intl = useIntl();
  const isPermit2Approval = approvalUtils.isPermit2Approval({ approval });

  const isSelected =
    !!selectedTokens[
      approvalUtils.buildSelectedTokenKey({
        accountId,
        networkId,
        contractAddress,
        tokenAddress: approval.tokenAddress,
        permit2Address: approval.permit2Address,
      })
    ];

  const token =
    tokenMap[
      approvalUtils.buildTokenMapKey({
        networkId,
        tokenAddress: approval.tokenAddress,
      })
    ];

  const approvalDate = formatDate(new Date(approval.time), {
    hideTimeForever: true,
  });
  const compactApprovalDate = formatDate(new Date(approval.time), {
    hideTheYear: true,
    hideTimeForever: true,
  });
  const permit2ExpirationInfo = useMemo(() => {
    if (!isPermit2Approval) {
      return undefined;
    }

    const expiration = approvalUtils.normalizePermit2ExpirationMs(
      approval.expirationMs,
    );
    if (!expiration) {
      return {
        displayText: '--',
        accessibilityText: '--',
      };
    }
    if (expiration.isNeverExpires) {
      const neverExpiresText = intl.formatMessage({
        id: ETranslations.wallet_approval_permit2_never_expires__desc,
      });
      return {
        displayText: neverExpiresText,
        accessibilityText: neverExpiresText,
      };
    }

    const expirationDate = new Date(
      Number(expiration.expirationSeconds) * 1000,
    );
    if (Number.isNaN(expirationDate.getTime())) {
      return {
        displayText: '--',
        accessibilityText: '--',
      };
    }
    const formattedExpiration = formatDate(expirationDate, {
      hideSeconds: true,
    });
    if (!formattedExpiration || formattedExpiration === '-') {
      return {
        displayText: '--',
        accessibilityText: '--',
      };
    }

    const approvalYear = new Date(approval.time).getFullYear();
    const compactExpiration = formatDate(expirationDate, {
      hideYear: approvalYear === expirationDate.getFullYear(),
      hideSeconds: true,
    });

    const displayExpiration =
      compactExpiration && compactExpiration !== '-'
        ? compactExpiration
        : formattedExpiration;

    return {
      displayText: intl.formatMessage(
        {
          id: ETranslations.wallet_approval_permit2_expires_at__desc,
        },
        { date: displayExpiration },
      ),
      accessibilityText: intl.formatMessage(
        {
          id: ETranslations.wallet_approval_permit2_expires_at__desc,
        },
        { date: formattedExpiration },
      ),
    };
  }, [approval.expirationMs, approval.time, intl, isPermit2Approval]);

  if (!token) {
    return null;
  }

  const allowanceContent = approval.isInfiniteAmount ? (
    <SizableText
      size="$bodyMdMedium"
      numberOfLines={1}
      ellipsizeMode="tail"
      flexShrink={1}
      minWidth={0}
    >
      {intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_amount_un_limit,
      })}
    </SizableText>
  ) : (
    <NumberSizeableText
      numberOfLines={1}
      ellipsizeMode="tail"
      size="$bodyMdMedium"
      autoFormatter="balance-marketCap"
      flexShrink={1}
      minWidth={0}
    >
      {approval.allowanceParsed}
    </NumberSizeableText>
  );

  const revokeAccessibilityLabel = intl.formatMessage(
    { id: ETranslations.global_revoke_approve },
    { symbol: token.info.symbol },
  );
  const isRevokeLoading = isBuildingRevokeTxs && isSelected;
  const handleRevokePress = () => {
    void onRevoke({ approval, tokenInfo: token.info });
  };
  let revokeAction: ReactNode;
  if (isSelectMode) {
    revokeAction = (
      <Checkbox
        testID={ApprovalManagementTestIDs.tokenItemCheckbox}
        value={isSelected}
        shouldStopPropagation
        containerProps={{ py: '$0', flexShrink: 0 }}
        accessibilityLabel={token.info.symbol}
        onChange={(value) => {
          void onSelect({
            approval,
            isSelected: value === true,
          });
        }}
      />
    );
  } else {
    revokeAction = (
      <Button
        testID={ApprovalManagementTestIDs.tokenRevokeBtn}
        size="small"
        accessibilityLabel={revokeAccessibilityLabel}
        loading={isRevokeLoading}
        disabled={isBuildingRevokeTxs}
        onPress={handleRevokePress}
      >
        {intl.formatMessage({ id: ETranslations.global_revoke })}
      </Button>
    );
  }

  return (
    <ListItem
      alignItems="center"
      py="$2.5"
      renderItemText={
        <YStack flex={1} minWidth={0} maxWidth="100%" gap="$0.5">
          <XStack
            alignItems="baseline"
            gap="$1"
            minWidth={0}
            maxWidth="100%"
            overflow="hidden"
          >
            {allowanceContent}
            <SizableText
              size="$bodyMdMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              flexShrink={0}
              minWidth={0}
              maxWidth="45%"
            >
              {token.info.symbol}
            </SizableText>
          </XStack>

          <XStack
            alignItems="center"
            columnGap="$1.5"
            minWidth={0}
            maxWidth="100%"
            overflow="hidden"
          >
            {isPermit2Approval ? (
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={0}
              >
                Permit2 ·
              </SizableText>
            ) : null}
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="tail"
              flex={1}
              minWidth={0}
            >
              {permit2ExpirationInfo ? (
                <>
                  {intl.formatMessage({
                    id: ETranslations.global_approval_time,
                  })}{' '}
                  {compactApprovalDate}
                </>
              ) : (
                approvalDate
              )}
            </SizableText>
          </XStack>
          {permit2ExpirationInfo ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="tail"
              minWidth={0}
              maxWidth="100%"
              accessibilityLabel={permit2ExpirationInfo.accessibilityText}
            >
              {permit2ExpirationInfo.displayText}
            </SizableText>
          ) : null}
        </YStack>
      }
      avatarProps={{
        src: token.info.logoURI,
        size: '$8',
        borderRadius: '$full',
        fallbackProps: {
          bg: '$gray5',
          width: '$8',
          height: '$8',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon size="$5" name="CryptoCoinOutline" />,
        },
      }}
      onPress={
        isSelectMode
          ? () => {
              void onSelect({
                approval,
                isSelected: !isSelected,
              });
            }
          : undefined
      }
    >
      <Stack
        height="$8"
        flexShrink={0}
        alignItems="flex-end"
        justifyContent="center"
      >
        {revokeAction}
      </Stack>
    </ListItem>
  );
}

export default memo(ApprovedTokenItem);
