import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ToolListView } from '../components/ToolListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function ToolListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const tools = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceTool.demoFetchTools();
    return r;
  }, []);
  return (
    <ToolListView
      data={tools.result ?? []}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { ToolListContainer };
