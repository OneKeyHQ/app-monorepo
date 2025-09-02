import { memo, useCallback, useMemo } from 'react';

import { Checkbox, Stack } from '@onekeyhq/components';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useApprovalListActions,
  useIsBulkRevokeModeAtom,
  useSelectedTokensAtom,
} from '../../states/jotai/contexts/approvalList';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  approval: IContractApproval;
};

function ApprovalCheckMark(props: IProps) {
  const { approval } = props;

  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();
  const [{ selectedTokens }] = useSelectedTokensAtom();
  const { updateSelectedTokens } = useApprovalListActions().current;

  const { selectDisabled } = useApprovalListViewContext();

  const { isSelectAllTokens } = useMemo(() => {
    return approvalUtils.checkIsSelectAllTokens({
      approvals: [approval],
      selectedTokens,
    });
  }, [approval, selectedTokens]);

  const handleOnChange = useCallback(() => {
    const selectedTokensTemp = approvalUtils.buildToggleSelectAllTokensMap({
      approvals: [approval],
      toggle: !(isSelectAllTokens === true),
    });

    updateSelectedTokens({
      selectedTokens: selectedTokensTemp,
      merge: true,
    });
  }, [approval, isSelectAllTokens, updateSelectedTokens]);

  if (!isBulkRevokeMode || selectDisabled) {
    return null;
  }

  return (
    <Stack
      pr="$3"
      onPress={(e) => {
        e.stopPropagation();
        handleOnChange();
      }}
    >
      <Checkbox value={isSelectAllTokens} />
    </Stack>
  );
}

export default memo(ApprovalCheckMark);
