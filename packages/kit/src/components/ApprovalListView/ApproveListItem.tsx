import { memo } from 'react';
import { ListItem } from '../ListItem';
import { IAccountApproval } from '@onekeyhq/shared/types/approval';

type IProps = {
  approval: IAccountApproval;
};

function ApproveListItem(props: IProps) {
   const { approval } = props;

  return <ListItem />;
}

export default memo(ApproveListItem);
