import { memo, useCallback } from 'react';

import { Stack, XStack, YStack } from '@onekeyhq/components';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import { ListItem } from '../ListItem';

import ApprovalCheckMark from './ApprovalCheckMark';
import { useApprovalListViewContext } from './ApprovalListViewContext';
import ApprovalTimeView from './ApprovalTimeView';
import ApprovalTokenView from './ApprovalTokenView';
import ContractAddressView from './ContractAddressView';
import ContractIconView from './ContractIconView';
import ContractNameView from './ContractNameView';
import ContractNetworkView from './ContractNetworkView';

type IProps = {
  approval: IContractApproval;

  onPress?: (approval: IContractApproval) => void;
};

function ApproveListItem(props: IProps) {
  const { approval, onPress } = props;

  const { tableLayout } = useApprovalListViewContext();

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
          address={approval.contractAddress}
          networkId={approval.networkId}
        />
        <YStack flex={1}>
          <ContractNameView
            address={approval.contractAddress}
            networkId={approval.networkId}
            isRiskContract={approval.isRiskContract}
            isInactiveApproval={approval.isInactiveApproval}
          />
          {tableLayout ? (
            <ContractNetworkView networkId={approval.networkId} />
          ) : (
            <ContractAddressView
              address={approval.contractAddress}
              networkId={approval.networkId}
              showShortAddress
              addressStyleProps={{
                size: '$bodyMd',
                color: '$textSubdued',
              }}
            />
          )}
        </YStack>
      </XStack>
    );
  }, [approval, tableLayout]);

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
            }
          : { flex: 1 })}
      >
        <ContractAddressView
          address={approval.contractAddress}
          networkId={approval.networkId}
          showShortAddress
          showCopy
          showExternalLink
        />
      </Stack>
    );
  }, [tableLayout, approval]);

  const renderThirdColumn = useCallback(() => {
    if (!tableLayout) {
      return null;
    }
    return (
      <Stack flexGrow={1} flexBasis={0}>
        <ApprovalTokenView approval={approval} />
      </Stack>
    );
  }, [tableLayout, approval]);

  const renderFourthColumn = useCallback(() => {
    if (tableLayout) {
      return (
        <YStack flexGrow={1} flexBasis={0} alignItems="flex-end" maxWidth="$36">
          <ApprovalTimeView approvalTime={approval.latestApprovalTime} />
        </YStack>
      );
    }
    return (
      <Stack alignItems="flex-end" maxWidth="$36" pr={6}>
        <ApprovalTokenView approval={approval} />
      </Stack>
    );
  }, [approval, tableLayout]);

  return (
    <ListItem
      userSelect="none"
      gap={tableLayout ? '$3' : '$1'}
      alignItems="center"
      drillIn={!tableLayout}
      onPress={() => {
        onPress?.(approval);
      }}
      childrenBefore={<ApprovalCheckMark approval={approval} />}
    >
      {renderFirstColumn()}
      {renderSecondColumn()}
      {renderThirdColumn()}
      {renderFourthColumn()}
    </ListItem>
  );
}

export default memo(ApproveListItem);
