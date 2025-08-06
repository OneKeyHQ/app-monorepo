import { useIntl } from 'react-intl';

import { Button, Checkbox, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IApproval } from '@onekeyhq/shared/types/approval';

import { ListItem } from '../../../components/ListItem';
import { useTokenMapAtom } from '../../../states/jotai/contexts/approvalList';
import { memo, useState } from 'react';

type IProps = {
  networkId: string;
  approval: IApproval;
  isChecked: boolean;
  isSelectMode: boolean;
};

function ApprovedTokenItem(props: IProps) {
  const { networkId, approval, isSelectMode } = props;

  const [{ tokenMap }] = useTokenMapAtom();
  const intl = useIntl();

  const token =
    tokenMap[
      approvalUtils.buildTokenMapKey({
        networkId,
        tokenAddress: approval.tokenAddress,
      })
    ];

  return (
    <ListItem
      key={approval.tokenAddress}
      title={token.info.symbol}
      titleProps={{
        numberOfLines: 1,
      }}
      subtitle={formatDate(new Date(approval.time))}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: token.info.logoURI,
      }}
      onPress={() => {
        console.log('clicked');
      }}
      childrenBefore={
        isSelectMode ? (
          <Stack>
            <Checkbox />
          </Stack>
        ) : null
      }
    >
      <ListItem.Text
        align="right"
        primary={
          approval.isInfiniteAmount
            ? intl.formatMessage({
                id: ETranslations.swap_page_provider_approve_amount_un_limit,
              })
            : approval.allowanceParsed
        }
      />
      {isSelectMode ? null : (
        <Button size="small">
          {intl.formatMessage({ id: ETranslations.global_revoke })}
        </Button>
      )}
    </ListItem>
  );
}

export default memo(ApprovedTokenItem);
