import { memo, useMemo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useIsBulkRevokeModeAtom,
  useSelectedTokensAtom,
} from '../../states/jotai/contexts/approvalList';
import { checkIsSelectAllTokens } from '../../views/ApprovalManagement/utils';

type IProps = {
  approval: IContractApproval;
  tableLayout?: boolean;
};

function ApprovalTokenView(props: IProps) {
  const { approval, tableLayout } = props;
  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();

  const [{ selectedTokens }] = useSelectedTokensAtom();

  const { selectedCount } = useMemo(() => {
    return checkIsSelectAllTokens({
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
        {isBulkRevokeMode
          ? `${selectedCount} / ${approval.approvals.length}`
          : approval.approvals.length}
      </SizableText>
    </Stack>
  );
}

export default memo(ApprovalTokenView);
