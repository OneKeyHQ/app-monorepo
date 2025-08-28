import { memo, useCallback, useMemo } from 'react';

import { Checkbox, Stack } from '@onekeyhq/components';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useApprovalListActions,
  useIsBulkRevokeModeAtom,
  useSelectedTokensAtom,
} from '../../states/jotai/contexts/approvalList';
import {
  buildToggleSelectAllTokensMap,
  checkIsSelectAllTokens,
} from '../../views/ApprovalManagement/utils';

type IProps = {
  approval: IContractApproval;
};

function ApprovalCheckMark(props: IProps) {
  const { approval } = props;

  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();
  const [{ selectedTokens }] = useSelectedTokensAtom();
  const { updateSelectedTokens } = useApprovalListActions().current;

  const { isSelectAllTokens } = useMemo(() => {
    return checkIsSelectAllTokens({
      approvals: [approval],
      selectedTokens,
    });
  }, [approval, selectedTokens]);

  const handleOnChange = useCallback(() => {
    const selectedTokensTemp = buildToggleSelectAllTokensMap({
      approvals: [approval],
      toggle: !(isSelectAllTokens === true),
    });

    updateSelectedTokens({
      selectedTokens: selectedTokensTemp,
      merge: true,
    });
  }, [approval, isSelectAllTokens, updateSelectedTokens]);

  if (!isBulkRevokeMode) {
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
