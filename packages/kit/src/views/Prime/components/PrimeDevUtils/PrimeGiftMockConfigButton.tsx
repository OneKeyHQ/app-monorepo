import { Button, Dialog, Input, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showDevOnlyPasswordDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/DevSettingsSection/showDevOnlyPasswordDialog';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function PrimeGiftMockConfigButton() {
  if (!platformEnv.isDev) return null;
  return (
    <Button
      testID="pro2-prime-configure-mock"
      onPress={() => {
        Dialog.show({
          title: 'Configure Pro 2 Prime gift mock',
          description:
            'Register a device serial number and a valid test redemption code. Device authentication and Prime redemption use real services. Leave the code empty to preserve its current value.',
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: {
                  serialNo: '',
                  giftMonths: '6',
                  redeemCode: '',
                },
              }}
            >
              <Dialog.FormField
                name="serialNo"
                label="Device serial number"
                rules={{ required: true }}
              >
                <Input
                  testID="pro2-prime-mock-serial"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Dialog.FormField>
              <Dialog.FormField
                name="giftMonths"
                label="Gift months"
                rules={{ required: true }}
              >
                <Input
                  testID="pro2-prime-mock-months"
                  keyboardType="number-pad"
                />
              </Dialog.FormField>
              <Dialog.FormField name="redeemCode" label="Test redemption code">
                <Input
                  testID="pro2-prime-mock-code"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          onConfirmText: 'Configure',
          onConfirm: async ({ getForm, close, preventClose }) => {
            preventClose();
            const form = getForm();
            if (!form || !(await form.trigger())) return;
            const values = form.getValues() as {
              serialNo: string;
              giftMonths: string;
              redeemCode: string;
            };
            const giftMonths = Number(values.giftMonths);
            if (
              !values.serialNo.trim() ||
              !Number.isSafeInteger(giftMonths) ||
              giftMonths <= 0
            ) {
              Toast.error({
                title:
                  'Enter a serial number and a positive whole number of months.',
              });
              return;
            }
            await close();
            showDevOnlyPasswordDialog({
              title: 'Enable Pro 2 Prime gift mock',
              onConfirm: async (params) => {
                await backgroundApiProxy.servicePrime.configurePrimeGiftMock(
                  params,
                  {
                    enabled: true,
                    serialNo: values.serialNo.trim(),
                    giftMonths,
                    redeemCode: values.redeemCode.trim() || undefined,
                  },
                );
                Toast.success({
                  title:
                    'Prime gift mock configured. Reopen device details to claim.',
                });
              },
            });
          },
        });
      }}
    >
      Configure Pro 2 Prime gift
    </Button>
  );
}
