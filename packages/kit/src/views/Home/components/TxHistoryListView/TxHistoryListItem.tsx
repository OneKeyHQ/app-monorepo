import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountHistory } from '@onekeyhq/shared/types/history';

type IProps = {
  history: IAccountHistory;
  onPress?: (history: IAccountHistory) => void;
};

function TxHistoryListItem(props: IProps) {
  const { history, onPress } = props;
  const { decodedTx } = history;
  const { actions } = decodedTx;
  const action = actions[0];

  return (
    <ListItem
      key={history.id}
      title={action.type}
      subtitle={action.nativeTransfer?.to ?? 'any address'}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: action.nativeTransfer?.tokenInfo.logoURI,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      onPress={() => {
        onPress?.(history);
      }}
      outlineStyle="none"
      borderRadius="$0"
      paddingVertical="$4"
      margin="0"
    >
      <ListItem.Text
        align="right"
        primary={action.nativeTransfer?.amount ?? 'any value'}
        secondary={action.nativeTransfer?.amountValue ?? 'any value'}
        secondaryTextProps={{
          tone: 'subdued',
        }}
      />
    </ListItem>
  );
}

export { TxHistoryListItem };
