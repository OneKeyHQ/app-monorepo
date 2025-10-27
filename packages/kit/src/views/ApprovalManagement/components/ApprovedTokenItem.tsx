import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Icon,
  NumberSizeableText,
  Stack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ListItem } from '../../../components/ListItem';
import { useTokenMapAtom } from '../../../states/jotai/contexts/approvalList';

import { useApprovalManagementContext } from './ApprovalManagementContext';

type IProps = {
  accountId: string;
  networkId: string;
  approval: IApproval;
  isSelectMode: boolean;
  onSelect: ({
    tokenInfo,
    isSelected,
  }: {
    tokenInfo: IToken;
    isSelected: boolean;
  }) => Promise<void>;
  onRevoke: ({ tokenInfo }: { tokenInfo: IToken }) => Promise<void>;
};

function ApprovedTokenItem(props: IProps) {
  const { accountId, networkId, approval, isSelectMode, onRevoke, onSelect } =
    props;

  const [{ tokenMap }] = useTokenMapAtom();
  const { isBuildingRevokeTxs, selectedTokens } =
    useApprovalManagementContext();
  const intl = useIntl();

  const isSelected =
    !!selectedTokens[
      approvalUtils.buildSelectedTokenKey({
        accountId,
        networkId,
        contractAddress: approval.spenderAddress,
        tokenAddress: approval.tokenAddress,
      })
    ];

  const token =
    tokenMap[
      approvalUtils.buildTokenMapKey({
        networkId,
        tokenAddress: approval.tokenAddress,
      })
    ];

  if (!token) {
    return null;
  }

  return (
    <ListItem
      key={approval.tokenAddress}
      title={token.info.symbol}
      titleProps={{
        numberOfLines: 1,
      }}
      subtitle={formatDate(new Date(approval.time), {
        hideTimeForever: true,
      })}
      subtitleProps={{
        numberOfLines: 1,
      }}
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
                tokenInfo: token.info,
                isSelected: !isSelected,
              });
            }
          : undefined
      }
      childrenBefore={
        isSelectMode ? (
          <Stack>
            <Checkbox
              value={isSelected}
              onChange={() => {
                void onSelect({
                  tokenInfo: token.info,
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
          size="small"
          loading={isBuildingRevokeTxs ? isSelected : null}
          disabled={isBuildingRevokeTxs}
          onPress={() => {
            void onRevoke({ tokenInfo: token.info });
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_revoke })}
        </Button>
      )}
    </ListItem>
  );
}

export default memo(ApprovedTokenItem);
