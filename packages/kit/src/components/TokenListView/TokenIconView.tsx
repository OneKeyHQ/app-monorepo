import { useAccountData } from '../../hooks/useAccountData';
import { Token } from '../Token';

type IProps = {
  tableLayout?: boolean;
  icon?: string;
  networkId: string | undefined;
  isAllNetworks?: boolean;
};

function TokenIconView(props: IProps) {
  const { tableLayout, icon, networkId, isAllNetworks } = props;

  const { network } = useAccountData({ networkId });

  if (isAllNetworks) {
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
