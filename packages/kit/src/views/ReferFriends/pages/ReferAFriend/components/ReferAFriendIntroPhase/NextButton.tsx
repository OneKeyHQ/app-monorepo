import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EPhaseState } from '../../types';

interface INextButtonProps {
  setPhaseState: (state: EPhaseState | undefined) => void;
}

export function NextButton({ setPhaseState }: INextButtonProps) {
  const intl = useIntl();

  return (
    <Button
      variant="primary"
      onPress={async () => {
        setPhaseState(undefined);
        setTimeout(() => {
          setPhaseState(EPhaseState.join);
        }, 50);
      }}
    >
      {intl.formatMessage({
        id: ETranslations.global_next,
      })}
    </Button>
  );
}
