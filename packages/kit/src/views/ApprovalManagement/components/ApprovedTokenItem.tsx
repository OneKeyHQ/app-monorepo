import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
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
  const permit2ExpirationText = useMemo(() => {
    if (!isPermit2Approval) {
      return undefined;
    }

    const expiration = approvalUtils.normalizePermit2ExpirationMs(
      approval.expirationMs,
    );
    if (!expiration) {
      return '--';
    }
    if (expiration.isNeverExpires) {
      return intl.formatMessage({
        id: ETranslations.wallet_approval_permit2_never_expires__desc,
      });
    }

    const expirationDate = new Date(
      Number(expiration.expirationSeconds) * 1000,
    );
    if (Number.isNaN(expirationDate.getTime())) {
      return '--';
    }
    const formattedExpiration = formatDate(expirationDate, {
      hideSeconds: true,
    });
    if (!formattedExpiration || formattedExpiration === '-') {
      return '--';
    }

    return intl.formatMessage(
      {
        id: ETranslations.wallet_approval_permit2_expires_at__desc,
      },
      { date: formattedExpiration },
    );
  }, [approval.expirationMs, intl, isPermit2Approval]);

  if (!token) {
    return null;
  }

  return (
    <ListItem
      renderItemText={
        <ListItem.Text
          flex={1}
          primary={
            <XStack alignItems="center" gap="$1.5" flex={1}>
              <SizableText size="$bodyLgMedium" numberOfLines={1}>
                {token.info.symbol}
              </SizableText>
              {isPermit2Approval ? (
                <Badge
                  badgeSize="sm"
                  bg="$transparent"
                  borderWidth={1}
                  borderColor="$borderSubdued"
                >
                  <Badge.Text>Permit2</Badge.Text>
                </Badge>
              ) : null}
            </XStack>
          }
          secondary={
            <YStack>
              <SizableText size="$bodyMd" color="$textSubdued">
                {approvalDate}
              </SizableText>
              {permit2ExpirationText ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {permit2ExpirationText}
                </SizableText>
              ) : null}
            </YStack>
          }
        />
      }
      avatarProps={{
        src: token.info.logoURI,
        borderRadius: '$full',
        fallbackProps: {
          bg: '$gray5',
          width: '$10',
          height: '$10',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon size="$7" name="CryptoCoinOutline" />,
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
      childrenBefore={
        isSelectMode ? (
          <Stack>
            <Checkbox
              testID={ApprovalManagementTestIDs.tokenItemCheckbox}
              value={isSelected}
              onChange={() => {
                void onSelect({
                  approval,
                  isSelected: !isSelected,
                });
              }}
            />
          </Stack>
        ) : null
      }
    >
      <ListItem.Text
        align="right"
        flex={1}
        primary={
          approval.isInfiniteAmount ? (
            intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            })
          ) : (
            <NumberSizeableText
              numberOfLines={1}
              textAlign="right"
              size="$bodyLgMedium"
              autoFormatter="balance-marketCap"
            >
              {approval.allowanceParsed}
            </NumberSizeableText>
          )
        }
      />
      {isSelectMode ? null : (
        <Button
          testID={ApprovalManagementTestIDs.tokenRevokeBtn}
          size="small"
          loading={isBuildingRevokeTxs ? isSelected : null}
          disabled={isBuildingRevokeTxs}
          onPress={() => {
            void onRevoke({ approval, tokenInfo: token.info });
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_revoke })}
        </Button>
      )}
    </ListItem>
  );
}

export default memo(ApprovedTokenItem);
