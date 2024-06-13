import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function FirmwareUpdatePageHeader() {
  const intl = useIntl();
  return (
    <Page.Header
      dismissOnOverlayPress={false}
      // disableClose
      title={intl.formatMessage({
        id: ETranslations.update_checking_for_updates,
      })}
    />
  );
}

export const FirmwareUpdatePageFooter = Page.Footer;

export function FirmwareUpdatePageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  // () => navigation.popStack()

  return (
    <Stack>
      <FirmwareUpdatePageHeader />
      <Page.Body>
        <Stack p="$5">{children}</Stack>
      </Page.Body>
    </Stack>
  );
}
