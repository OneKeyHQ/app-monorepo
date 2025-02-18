import { Step, Stepper } from './Stepper';

export function TransferSteps() {
  return (
    <Stepper>
      <Step index={1} title="Keep devices on same network" />
      <Step index={2} title="Open OneKey on another device" />
      <Step
        index={3}
        title="Scan the QR code on this page."
        description='Alternatively, go to "Wallet > Account > Add wallet" and click "Transfer." Then, paste the link below the QR code'
      />
    </Stepper>
  );
}
