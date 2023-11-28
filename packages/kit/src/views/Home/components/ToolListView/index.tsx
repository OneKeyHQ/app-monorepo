import { ListView } from '@onekeyhq/components';
import type { ITool } from '@onekeyhq/shared/types';

import { ToolListItem } from './ToolListItem';

type IProps = {
  data: ITool[];
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};
function ToolListView(props: IProps) {
  const { data, onContentSizeChange } = props;
  return (
    <ListView
      data={data}
      onContentSizeChange={onContentSizeChange}
      estimatedItemSize={80}
      renderItem={({ item }) => <ToolListItem tool={item} key={item.title} />}
      numColumns={2}
    />
  );
}

export { ToolListView };
