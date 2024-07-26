import { Spinner } from '@onekeyhq/components';

import { useCreateAccountStateAtom } from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
  networkId: string;
};

function CreateAccountView(props: IProps) {
  const { $key, networkId } = props;
  const [createAccountState] = useCreateAccountStateAtom();

  if (
    createAccountState.isCreating &&
    createAccountState.token?.$key === $key &&
    createAccountState.token?.networkId === networkId
  ) {
    return <Spinner />;
  }

  return null;
}

export { CreateAccountView };
