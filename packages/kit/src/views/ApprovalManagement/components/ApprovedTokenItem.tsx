import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  NumberSizeableText,
  Stack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IApproval } from '@onekeyhq/shared/types/approval';

import { ListItem } from '../../../components/ListItem';
import { useTokenMapAtom } from '../../../states/jotai/contexts/approvalList';

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

  const token = tokenMap[
    approvalUtils.buildTokenMapKey({
      networkId,
      tokenAddress: approval.tokenAddress,
    })
  ] ?? {
    price: 0,
    price24h: 0,
    info: { symbol: '', logoURI: '' },
  };

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
      }}
      onPress={
        isSelectMode
          ? () => {
              console.log('clicked');
            }
          : undefined
      }
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
        flex={1}
        primary={
          approval.isInfiniteAmount ? (
            intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            })
          ) : (
            <NumberSizeableText
              textAlign="right"
              size="$bodyLgMedium"
              formatter="balance"
            >
              {approval.allowanceParsed}
            </NumberSizeableText>
          )
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
