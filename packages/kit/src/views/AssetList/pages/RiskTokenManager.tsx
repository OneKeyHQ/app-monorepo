import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function RiskTokenManager() {
  const intl = useIntl();

  const [isEditing, setIsEditing] = useState(false);

  const headerRight = useCallback(() => {
    return (
      <Button
        size="sm"
        variant="tertiary"
        onPress={() => {
          setIsEditing((prev) => !prev);
        }}
      >
        {intl.formatMessage({
          id: isEditing ? ETranslations.global_done : ETranslations.global_edit,
        })}
      </Button>
    );
  }, [intl, isEditing]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_risk_assets,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <Alert
          type="danger"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_risk_assets_description,
          })}
          fullBleed
        />
      </Page.Body>
    </Page>
  );
}

export default RiskTokenManager;
