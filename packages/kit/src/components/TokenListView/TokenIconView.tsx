import { useAccountData } from '../../hooks/useAccountData';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { Token } from '../Token';

type IProps = {
  tableLayout?: boolean;
  icon?: string;
  networkId: string | undefined;
};

function TokenIconView(props: IProps) {
  const { tableLayout, icon, networkId } = props;
  const {
    activeAccount: { network: activeNetwork },
  } = useActiveAccount({ num: 0 });

  const { network } = useAccountData({ networkId });

  if (activeNetwork?.isAllNetworks) {
    return (
      <Token
        size={tableLayout ? 'md' : 'lg'}
        tokenImageUri={icon}
        networkImageUri={network?.logoURI}
      />
    );
  }

  return <Token size={tableLayout ? 'md' : 'lg'} tokenImageUri={icon} />;
}

export { TokenIconView };
