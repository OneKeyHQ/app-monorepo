import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { TokenListView } from '../components/TokenListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const tokens = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId: 'evm--1',
      accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
    });
    console.log('r', r);
    return r;
  }, []);

  console.log(tokens);

  return (
    <TokenListView
      data={tokens.result?.data ?? []}
      isLoading={tokens.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { TokenListContainer };
