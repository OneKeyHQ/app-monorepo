import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { DefiListView } from '../components/DefiListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function DefiListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const defi = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceDefi.fetchAccountDefi({
      networkId: 'evm--1',
      accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
    });
    return r.data;
  }, []);
  return (
    <DefiListView
      data={defi.result ?? []}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { DefiListContainer };
