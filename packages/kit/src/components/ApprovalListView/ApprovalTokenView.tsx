import { memo, useMemo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useIsBulkRevokeModeAtom,
  useSelectedTokensAtom,
} from '../../states/jotai/contexts/approvalList';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  approval: IContractApproval;
};

function ApprovalTokenView(props: IProps) {
  const { approval } = props;

  const { tableLayout, selectDisabled } = useApprovalListViewContext();

  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();

  const [{ selectedTokens }] = useSelectedTokensAtom();

  const { selectedCount } = useMemo(() => {
    return approvalUtils.checkIsSelectAllTokens({
      approvals: [approval],
      selectedTokens,
    });
  }, [approval, selectedTokens]);

  return (
    <Stack>
      <SizableText
        size={tableLayout ? '$bodyMdMedium' : '$bodyMd'}
        color={tableLayout ? '$text' : '$textSubdued'}
      >
        {isBulkRevokeMode && !selectDisabled
          ? `${selectedCount} / ${approval.approvals.length}`
          : approval.approvals.length}
      </SizableText>
    </Stack>
  );
}

export default memo(ApprovalTokenView);
