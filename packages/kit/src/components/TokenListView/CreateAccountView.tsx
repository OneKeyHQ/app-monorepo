import { useIntl } from 'react-intl';

import { SizableText, Spinner, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCreateAccountStateAtom } from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
  networkId: string;
};

function CreateAccountView(props: IProps) {
  const { $key, networkId } = props;
  const [createAccountState] = useCreateAccountStateAtom();
  const intl = useIntl();

  if (
    createAccountState.isCreating &&
    createAccountState.token?.$key === $key &&
    createAccountState.token?.networkId === networkId
  ) {
    return (
      <XStack alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
          {intl.formatMessage({ id: ETranslations.global_creating_address })}
        </SizableText>
        <Spinner size="small" />
      </XStack>
    );
  }

  return null;
}

export { CreateAccountView };
