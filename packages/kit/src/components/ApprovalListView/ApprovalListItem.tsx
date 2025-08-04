import { memo, useCallback } from 'react';

import { Stack, XStack, YStack } from '@onekeyhq/components';
import type { IAccountApproval } from '@onekeyhq/shared/types/approval';

import { ListItem } from '../ListItem';

import ApprovalTimeView from './ApprovalTimeView';
import ApprovalTokenView from './ApprovalTokenView';
import ContractAddressView from './ContractAddressView';
import ContractIconView from './ContractIconView';
import ContractNameView from './ContractNameView';
import ContractNetworkView from './ContractNetworkView';

type IProps = {
  approval: IAccountApproval;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
};

function ApproveListItem(props: IProps) {
  const { approval, tableLayout, isAllNetworks } = props;

  const renderFirstColumn = useCallback(() => {
    return (
      <XStack
        alignItems="center"
        gap="$3"
        {...(tableLayout
          ? {
              flexGrow: 1,
              flexBasis: 0,
            }
          : { flex: 1 })}
      >
        <ContractIconView
          address={approval.spenderAddress}
          networkId={approval.networkId}
          isAllNetworks={isAllNetworks}
        />
        <YStack flex={1}>
          <ContractNameView address={approval.spenderAddress} />
          {tableLayout ? (
            <ContractNetworkView networkId={approval.networkId} />
          ) : (
            <ContractAddressView
              address={approval.spenderAddress}
              networkId={approval.networkId}
              isShort
              showCopy
              showExternalLink
              addressStyleProps={{
                size: '$bodyMd',
                color: '$textSubdued',
              }}
            />
          )}
        </YStack>
      </XStack>
    );
  }, [approval, tableLayout, isAllNetworks]);

  const renderSecondColumn = useCallback(() => {
    if (!tableLayout) {
      return null;
    }

    return (
      <Stack
        {...(tableLayout
          ? {
              flexGrow: 1,
              flexBasis: 0,
              maxWidth: '$36',
            }
          : { flex: 1 })}
      >
        <ContractAddressView
          address={approval.spenderAddress}
          networkId={approval.networkId}
        />
      </Stack>
    );
  }, [tableLayout, approval]);

  const renderThirdColumn = useCallback(() => {
    if (!tableLayout) {
      return null;
    }
    return (
      <YStack flexGrow={1} flexBasis={0}>
        <ApprovalTimeView />
      </YStack>
    );
  }, [tableLayout]);

  const renderFourthColumn = useCallback(() => {
    return (
      <Stack flexGrow={1} flexBasis={0}>
        <ApprovalTokenView />
      </Stack>
    );
  }, []);

  return (
    <ListItem
      key={approval.spenderAddress}
      userSelect="none"
      gap={tableLayout ? '$3' : '$1'}
      alignItems="center"
    >
      {renderFirstColumn()}
      {renderSecondColumn()}
      {renderThirdColumn()}
      {renderFourthColumn()}
    </ListItem>
  );
}

export default memo(ApproveListItem);
