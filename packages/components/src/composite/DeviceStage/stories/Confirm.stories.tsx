import { useEffect } from 'react';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageProps } from '@onekeyhq/components/src/composite/DeviceStage';

import {
  ARG_TYPES,
  DEMO,
  StageHost,
  StepButton,
  useStageDriver,
} from './harness';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

/**
 * The confirm scenarios, one story each — the full inventory of what the
 * app asks the person to verify against the device, three content shapes:
 * rows (verify fields), a text block (the signed original), a description
 * (device actions with no payload). The values here are the scenario
 * board's demo data, verbatim.
 */

const meta = {
  title: 'Composite/DeviceStage/Confirm',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'slate',
    deviceName: DEMO.deviceName,
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The confirm move at full length: the neighbors for the shrink, the
// miniature with the payload card queuing in last, the exit through
// processing. The one story with the whole walk — the scene stories
// below cut straight to the design.
function ConfirmStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="connecting">
        Connecting
      </StepButton>
      <StepButton driver={driver} step="enterPin">
        PIN on device
      </StepButton>
      <StepButton driver={driver} step="confirm">
        Confirm
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
    </StageHost>
  );
}

// A scene story opens on the confirm card itself — the driver walks
// off → confirm on mount, so the story shows the scenario's design
// without any manual stepping. Two controls only: replay the arrival,
// and the exit.
function ConfirmScene(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  const { go } = driver;
  useEffect(() => {
    go('confirm');
  }, [go]);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="confirm">
        Confirm
      </StepButton>
    </StageHost>
  );
}

/** The full walk, worn by scenario 01 (the receive page's address
 * verify — the address the device derives from its own seed, against
 * the app's stored copy). */
export const Flow: Story = {
  render: ConfirmStage,
  args: {
    confirmDetails: DEMO.confirmDetails,
  },
};

/* ------------------------------------------------------------------ */
/* Family 1 — verify fields (rows)                                     */
/* ------------------------------------------------------------------ */

/** 02 · Plain transfer — the device pages address → amount → fee →
 * summary; the card lists the whole run at once. */
export const Transfer: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      {
        label: 'To',
        value: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
        highlightEnds: true,
      },
      { label: 'Amount', value: '0.5 ETH' },
      { label: 'Network fee', value: '0.00042 ETH' },
    ],
  },
};

/** 03 · Token approval — the unlimited allowance wears the warning ink. */
export const Approve: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      { label: 'Token', value: 'USDC' },
      {
        label: 'Spender',
        value: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        highlightEnds: true,
      },
      { label: 'Allowance', value: 'Unlimited', warning: true },
    ],
  },
};

/** 04 · Contract interaction the app cannot decode — the raw data,
 * truncated; the device screen stays the full read. */
export const ContractData: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      {
        label: 'Contract',
        value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        highlightEnds: true,
      },
      { label: 'Amount', value: '0 ETH' },
      { label: 'Data', value: '0x38ed1739000000000000000000000001a2…' },
    ],
  },
};

/** 05 · A run of confirmations (approve-then-swap, batch sends) — the
 * count pill beside the title tracks the burst's place. */
export const Batch: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      { label: 'Step', value: 'Swap USDC → ETH' },
      { label: 'Amount', value: '1,200 USDC' },
    ],
    confirmCount: { current: 2, total: 3 },
  },
};

/* ------------------------------------------------------------------ */
/* Family 2 — the signed original (text block)                         */
/* ------------------------------------------------------------------ */

/** 06 · Message signing — the very text the person pages through on the
 * device; long content truncates, the device stays the full read. */
export const Message: Story = {
  render: ConfirmScene,
  args: {
    confirmMessage: `Welcome to OpenSea!

Click to sign in and accept the OpenSea Terms of Service. This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: 0x627ddbef61c811af05288cd79db324fcac914aef
Nonce: 2f8a1c90-77e4-4d1a-9c60-8f21b1a30d55`,
  },
};

/** 07 · Structured data (typed-data requests) — origin, type and the key
 * address as summary rows; full fields stay the device's read. */
export const TypedData: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      { label: 'Origin', value: 'app.uniswap.org' },
      { label: 'Type', value: 'PermitSingle' },
      {
        label: 'Spender',
        value: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        highlightEnds: true,
      },
    ],
  },
};

/** 08 · Sign-in proof — the domain is the one fact to verify; a phishing
 * domain shows itself here. */
export const SignIn: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [
      { label: 'Website', value: 'stacker.news' },
      { label: 'Account', value: 'Lightning #1' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Family 3 — device actions (description)                             */
/* ------------------------------------------------------------------ */

/** 09 · Wipe device — destructive, so the description panel inks danger. */
export const WipeDevice: Story = {
  render: ConfirmScene,
  args: {
    confirmDescription:
      'All data on this device will be erased. Your assets remain recoverable only with the recovery phrase.',
    confirmDescriptionDanger: true,
  },
};

/** 10/11 · Settings-family confirms (passphrase toggle here; change PIN,
 * wallpaper and device preferences share the shape). */
export const PassphraseOn: Story = {
  render: ConfirmScene,
  args: {
    confirmDescription:
      'Passphrase will be turned on. Each passphrase opens its own hidden wallet; the device may restart after confirming.',
  },
};

/** 12 · Rename device — a single new value to verify, so still rows. */
export const RenameDevice: Story = {
  render: ConfirmScene,
  args: {
    confirmDetails: [{ label: 'Device name', value: 'Franco’s Pro' }],
  },
};
