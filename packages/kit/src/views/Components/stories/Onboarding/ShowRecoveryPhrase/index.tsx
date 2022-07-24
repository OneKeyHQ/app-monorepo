import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import Layout from '../Layout';
import PhraseSheet from '../PhraseSheet';

type ShowRecoveryPhraseProps = {
  visible?: boolean;
  onPressBackButton?: () => void;
  onPressSavedPhrase?: () => void;
};

const defaultProps = {} as const;

const ShowRecoveryPhrase: FC<ShowRecoveryPhraseProps> = ({
  visible,
  onPressBackButton,
  onPressSavedPhrase,
}) => {
  const intl = useIntl();

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'content__click_below_to_copy' })}
        description={intl.formatMessage({
          id: 'modal__for_your_eyes_only_desc',
        })}
        fullHeight
        secondaryContent={
          <PhraseSheet onPressSavedPhrase={onPressSavedPhrase} />
        }
        visible={visible}
        onPressBackButton={onPressBackButton}
      />
    </>
  );
};

ShowRecoveryPhrase.defaultProps = defaultProps;

export default ShowRecoveryPhrase;
