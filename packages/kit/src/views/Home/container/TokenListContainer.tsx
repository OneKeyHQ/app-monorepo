import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { TokenListView } from '../components/TokenListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const tokens = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.demoFetchAccountTokens();
    return r;
  }, []);

  return (
    <TokenListView
      data={tokens.result ?? []}
      isLoading={tokens.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { TokenListContainer };
