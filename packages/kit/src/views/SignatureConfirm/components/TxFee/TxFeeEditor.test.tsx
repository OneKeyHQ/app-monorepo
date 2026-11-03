/** @jest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFeeSelectorItem } from '@onekeyhq/shared/types/fee';
import { EFeeType } from '@onekeyhq/shared/types/fee';

import { TxFeeEditor } from './TxFeeEditor';

type ISegmentControlProps = {
  value: string | number;
  options: { value: string | number; type: EFeeType }[];
  onChange: (value: string | number) => void;
};

const mockSegmentControl = jest.fn<null, [ISegmentControlProps]>(() => null);

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
// The jest config maps every @onekeyhq/components path, useForm included, to
// one module, so this mock serves both imports.
jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: unknown }) =>
    children ?? null;
  const Empty = () => null;
  const Form = Object.assign(Passthrough, { Field: Passthrough });
  return {
    Alert: Empty,
    Button: Empty,
    Checkbox: Empty,
    Form,
    Input: Empty,
    NumberSizeableText: Empty,
    ScrollView: Passthrough,
    SegmentControl: (props: ISegmentControlProps) => mockSegmentControl(props),
    SizableText: Passthrough,
    Stack: Passthrough,
    XStack: Passthrough,
    YStack: Passthrough,
    useDialogInstance: () => ({ close: jest.fn() }),
    useForm:
      jest.requireActual<typeof import('react-hook-form')>('react-hook-form')
        .useForm,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: { vaultSettings: { editFeeEnabled: true }, network: {} },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { TxFeeInfoChanged: 'TxFeeInfoChanged' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

const common = {
  feeDecimals: 9,
  feeSymbol: 'Gwei',
  nativeDecimals: 18,
  nativeSymbol: 'ETH',
};

// TxFeeInfo gives the only base-fee fallback item value 1, and Custom,
// appended after it, gets value items.length, which is 1 too.
const fallbackFeeSelectorItems: IFeeSelectorItem[] = [
  {
    label: 'Normal',
    icon: '',
    value: 1,
    feeInfo: { common },
    type: EFeeType.Standard,
  },
  {
    label: 'Custom',
    icon: '',
    value: 1,
    feeInfo: { common },
    type: EFeeType.Custom,
  },
];

// The form validates on mount and settles its state a tick later.
async function renderTxFeeEditor() {
  await act(async () => {
    render(
      <TxFeeEditor
        networkId="evm--1"
        feeSelectorItems={fallbackFeeSelectorItems}
        sendSelectedFee={{ feeType: EFeeType.Standard, presetIndex: 0 }}
        originalCustomFee={{ common }}
        selectedFee={undefined}
        unsignedTxs={[{} as IUnsignedTxPro]}
        onApplyFeeInfo={jest.fn()}
      />,
    );
  });
}

function getSegmentControlProps() {
  const props = mockSegmentControl.mock.lastCall?.[0];
  expect(props).toBeDefined();
  return props as ISegmentControlProps;
}

function getSelectedFeeTypes() {
  const { value, options } = getSegmentControlProps();
  return options.filter((option) => option.value === value).map((o) => o.type);
}

function pressOption(index: number) {
  const { options, onChange } = getSegmentControlProps();
  act(() => {
    onChange(options[index].value);
  });
}

describe('TxFeeEditor fee type selector with only the base-fee fallback', () => {
  afterEach(() => {
    cleanup();
    mockSegmentControl.mockClear();
  });

  it('selects the fallback item, and only it, on open', async () => {
    await renderTxFeeEditor();

    expect(getSelectedFeeTypes()).toEqual([EFeeType.Standard]);
  });

  it('selects the item that was pressed', async () => {
    await renderTxFeeEditor();

    pressOption(1);
    expect(getSelectedFeeTypes()).toEqual([EFeeType.Custom]);

    pressOption(0);
    expect(getSelectedFeeTypes()).toEqual([EFeeType.Standard]);
  });
});
