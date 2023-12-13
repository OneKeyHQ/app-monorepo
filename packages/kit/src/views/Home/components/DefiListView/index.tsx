import { Empty, ListView, Stack } from '@onekeyhq/components';
import type { IAccountDefi } from '@onekeyhq/shared/types/defi';

import { DefiListHeader } from './DefiListHeader';
import { DefiListItem } from './DefiListItem';

type IProps = {
  data: IAccountDefi[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function DefiListEmpty() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty />
    </Stack>
  );
}

function DefiListView(props: IProps) {
  const { data, onContentSizeChange } = props;

  return (
    <ListView
      h="100%"
      estimatedItemSize={76}
      scrollEnabled={false}
      data={data}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={DefiListEmpty}
      ListHeaderComponent={DefiListHeader}
      ListHeaderComponentStyle={{
        mt: '$4',
        mb: '$2',
      }}
      renderItem={({ item }) => (
        <DefiListItem defi={item} key={item.projectName} />
      )}
    />
  );
}

export { DefiListView };
