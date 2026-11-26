/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFeeSelectorItem } from '@onekeyhq/shared/types/fee';
import { EFeeType } from '@onekeyhq/shared/types/fee';

import { TxFeeEditor } from './TxFeeEditor';

import type {
  FieldValues,
  RegisterOptions,
  UseFormReturn,
} from 'react-hook-form';

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
  const { Controller, FormProvider, useForm } =
    jest.requireActual<typeof import('react-hook-form')>('react-hook-form');
  const { Children, cloneElement, isValidElement } =
    jest.requireActual<typeof import('react')>('react');
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  const Empty = () => null;
  const Form = Object.assign(
    ({ form, children }: { form: UseFormReturn; children: ReactNode }) => (
      <FormProvider {...form}>{children}</FormProvider>
    ),
    {
      Field: ({
        name,
        rules,
        children,
      }: {
        name: string;
        rules: RegisterOptions<FieldValues>;
        children: ReactNode;
      }) => (
        <Controller
          name={name}
          rules={rules}
          render={({ field }) => {
            const input = Children.only(children);
            return isValidElement<typeof field>(input) ? (
              cloneElement(input, field)
            ) : (
              <span />
            );
          }}
        />
      ),
    },
  );
  return {
    Alert: Empty,
    Button: ({
      children,
      testID,
      disabled,
      onPress,
    }: {
      children: ReactNode;
      testID: string;
      disabled: boolean;
      onPress: () => Promise<void>;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={() => void onPress()}
      >
        {children}
      </button>
    ),
    Checkbox: Empty,
    Form,
    Input: ({
      testID,
      value,
      onChange,
    }: {
      testID: string;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <input
        data-testid={testID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
    NumberSizeableText: ({ children }: { children: ReactNode }) => (
      <span>{children}</span>
    ),
    ScrollView: Passthrough,
    SegmentControl: (props: ISegmentControlProps) => mockSegmentControl(props),
    SizableText: Passthrough,
    Stack: Passthrough,
    XStack: Passthrough,
    YStack: Passthrough,
    useDialogInstance: () => ({ close: jest.fn() }),
    useForm,
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

describe('TxFeeEditor Starknet custom maximum fee', () => {
  afterEach(() => {
    cleanup();
    mockSegmentControl.mockClear();
  });

  it('edits a single maximum and saves the derived resource caps', async () => {
    const feeInfo = {
      common: {
        ...common,
        feeDecimals: 18,
        feeSymbol: 'STRK',
        nativeSymbol: 'STRK',
      },
      feeStarknet: {
        l1Gas: { maxAmount: '0', maxPricePerUnit: '1000' },
        l2Gas: {
          maxAmount: '200',
          maxPricePerUnit: '1000000000000000',
          estimatedPricePerUnit: '800000000000000',
        },
        l1DataGas: {
          maxAmount: '10',
          maxPricePerUnit: '1000000000000000',
          estimatedPricePerUnit: '800000000000000',
        },
        overallFee: '160000000000000000',
      },
    };
    const onApplyFeeInfo = jest.fn();
    await act(async () => {
      render(
        <TxFeeEditor
          networkId="starknet--mainnet"
          feeSelectorItems={fallbackFeeSelectorItems.map((item) => ({
            ...item,
            feeInfo,
          }))}
          sendSelectedFee={{ feeType: EFeeType.Standard, presetIndex: 0 }}
          originalCustomFee={feeInfo}
          selectedFee={undefined}
          unsignedTxs={[{} as IUnsignedTxPro]}
          onApplyFeeInfo={onApplyFeeInfo}
        />,
      );
    });
    expect(screen.getByText('0.16')).toBeTruthy();
    expect(screen.getByText('0.21')).toBeTruthy();
    pressOption(1);

    const save = screen.getByTestId<HTMLButtonElement>('signature-confirm-btn');
    const budget = screen.getByTestId<HTMLInputElement>(
      'sig-confirm-starknet-max-fee',
    );
    expect(screen.getAllByRole('textbox')).toEqual([budget]);
    expect(budget.value).toBe('0.21');
    fireEvent.change(budget, { target: { value: '0.165' } });
    await waitFor(() => expect(save.disabled).toBe(true));
    fireEvent.change(budget, { target: { value: '0.189' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(screen.getByText('0.16')).toBeTruthy();
    fireEvent.click(save);

    expect(onApplyFeeInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        feeType: EFeeType.Custom,
        customFeeInfo: expect.objectContaining({
          feeStarknet: {
            ...feeInfo.feeStarknet,
            l2Gas: {
              ...feeInfo.feeStarknet.l2Gas,
              maxPricePerUnit: '900000000000000',
            },
            l1DataGas: {
              ...feeInfo.feeStarknet.l1DataGas,
              maxPricePerUnit: '900000000000000',
            },
          },
        }),
      }),
    );
  });
});
