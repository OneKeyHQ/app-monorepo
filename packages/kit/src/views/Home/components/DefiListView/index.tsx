import {
  Empty,
  ListView,
  Stack,
  renderNestedScrollView,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountDefi } from '@onekeyhq/shared/types/defi';

import { DefiListHeader } from './DefiListHeader';
import { DefiListItem } from './DefiListItem';

type IProps = {
  data: IAccountDefi[];
  isLoading?: boolean;
  onRefresh?: () => void;
};

function DefiListEmpty() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty />
    </Stack>
  );
}

function DefiListView(props: IProps) {
  const { data } = props;

  return (
    <ListView
      renderScrollComponent={renderNestedScrollView}
      h="100%"
      estimatedItemSize={76}
      scrollEnabled={platformEnv.isWebTouchable}
      disableScrollViewPanResponder
      data={data}
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
