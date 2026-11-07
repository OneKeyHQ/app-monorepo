import type { PropsWithChildren } from 'react';

import { act, create } from 'react-test-renderer';

import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EFeeType } from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import { TxFeeEditor } from './TxFeeEditor';

const mockDialogClose = jest.fn(async () => {});

type ISegmentControlProps = {
  value: string | number;
  options: { value: string | number; type: EFeeType }[];
  onChange: (value: string | number) => void;
};

const mockSegmentControl = jest.fn<null, [ISegmentControlProps]>(() => null);

// The repository mapper aliases the components barrel and its subpaths to one
// module, so the direct hook mock also supplies the UI stubs.
jest.mock('@onekeyhq/components/src/hooks/useForm', () => {
  const { createElement, useState } =
    jest.requireActual<typeof import('react')>('react');
  const Host = ({
    children,
    ...hostProps
  }: PropsWithChildren<Record<string, unknown>>) =>
    createElement('mock-view', hostProps, children);
  const Form = Object.assign(Host, { Field: Host });
  return {
    Alert: Host,
    Button: Host,
    Checkbox: Host,
    Form,
    Input: Host,
    NumberSizeableText: Host,
    ScrollView: Host,
    SegmentControl: (segmentProps: ISegmentControlProps) =>
      mockSegmentControl(segmentProps),
    SizableText: Host,
    Stack: Host,
    XStack: Host,
    YStack: Host,
    useDialogInstance: () => ({ close: mockDialogClose }),
    useForm: jest.fn(
      ({ defaultValues }: { defaultValues: Record<string, string> }) => {
        const [values, setValues] = useState(defaultValues);
        return {
          watch: () => values,
          setValue: (name: string, value: string) =>
            setValues((current) => ({ ...current, [name]: value })),
          trigger: async () => true,
          formState: { isValid: true },
        };
      },
    ),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceGas: { updateCustomFeeInfo: async () => {} },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      vaultSettings: { editFeeEnabled: true },
      network: { name: 'Neo' },
    },
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { TxFeeInfoChanged: 'TxFeeInfoChanged' },
  appEventBus: { on: () => {}, off: () => {} },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_, name: string) => name }),
}));

jest.mock('@onekeyhq/shared/src/utils/feeUtils', () => ({
  calculateCkbTotalFee: () => '0',
  calculateNeoN3TotalFee: () => '0',
  calculateSolTotalFee: () => '0',
  calculateSuiTotalFee: () => '0',
  calculateTotalFeeNative: () => '0',
}));

const common = {
  feeDecimals: 8,
  feeSymbol: 'GAS',
  nativeDecimals: 8,
  nativeSymbol: 'GAS',
};

const neoFee: IFeeInfoUnit = {
  common,
  feeNeoN3: {
    systemFee: '100000000',
    networkFee: '200000000',
    priorityFee: '300000000',
  },
};

const evmFee: IFeeInfoUnit = {
  common: {
    ...common,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
  },
  gas: { gasLimit: '21000', gasPrice: '2' },
};

function props(originalCustomFee: IFeeInfoUnit | undefined) {
  return {
    networkId: 'neo--1',
    feeSelectorItems: [],
    sendSelectedFee: { feeType: EFeeType.Custom, presetIndex: 0 },
    originalCustomFee,
    selectedFee: undefined,
    unsignedTxs: [],
    onApplyFeeInfo: jest.fn(),
  };
}

function latestForm() {
  return jest.mocked(useForm).mock.results.at(-1)?.value as {
    setValue: (name: string, value: string) => void;
    watch: () => Record<string, string>;
  };
}

function selectedFee(feeInfo: IFeeInfoUnit) {
  return {
    feeInfo,
    total: '0',
    totalNative: '0',
    totalFiat: '0',
    totalNativeForDisplay: '0',
    totalFiatForDisplay: '0',
  };
}

async function pressSave(tree: ReturnType<typeof create>) {
  const save = tree.root.findByProps({ testID: 'signature-confirm-btn' });
  const onPress = save.props.onPress as () => Promise<void>;
  await onPress();
}

function expectFeeError(tree: ReturnType<typeof create> | undefined) {
  expect(
    tree?.root.findByProps({
      description: 'feedback_failed_to_fetch_fee_rate',
    }),
  ).toBeDefined();
  expect(
    tree?.root.findByProps({ testID: 'signature-confirm-fee-error-close' })
      .props.children,
  ).toBe('global_close');
  expect(
    tree?.root.findAllByProps({ testID: 'signature-confirm-btn' }),
  ).toHaveLength(0);
}

describe('TxFeeEditor precision readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['no fee', undefined],
    ['no common', {}],
    ['no precision', { common: {} }],
    ['NaN precision', { common: { feeDecimals: Number.NaN } }],
    [
      'infinite precision',
      { common: { feeDecimals: Number.POSITIVE_INFINITY } },
    ],
    ['negative precision', { common: { feeDecimals: -1 } }],
    ['fractional precision', { common: { feeDecimals: 0.5 } }],
    ['unsafe precision', { common: { feeDecimals: 1e20 } }],
    ['precision above the supported maximum', { common: { feeDecimals: 25 } }],
    [
      'large safe-integer precision with NeoN3 fees',
      { ...neoFee, common: { ...common, feeDecimals: 1_000_000 } },
    ],
  ])('does not mount form or save for %s', async (_, fee) => {
    const unsafeProps = props(fee as IFeeInfoUnit | undefined);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...unsafeProps} />);
    });
    expectFeeError(tree);
    expect(useForm).not.toHaveBeenCalled();
    await act(async () => {
      const close = tree?.root.findByProps({
        testID: 'signature-confirm-fee-error-close',
      });
      const onPress = close?.props.onPress as () => Promise<void>;
      await onPress();
    });
    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(unsafeProps.onApplyFeeInfo).not.toHaveBeenCalled();
  });

  it('accepts zero precision and keeps EVM fee fields unchanged', async () => {
    const zeroFee = { ...evmFee, common: { ...evmFee.common, feeDecimals: 0 } };
    const editorProps = props(zeroFee);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...editorProps} />);
    });
    expect(tree?.toJSON()).not.toBeNull();
    const formDefaults = latestForm().watch();
    expect(formDefaults.gasLimitLegacy).toBe('21000');
    expect(formDefaults.gasPrice).toBe('2');
    expect(formDefaults.neoN3SystemFee).toBe('0');
    await act(async () => {
      if (tree) await pressSave(tree);
    });
    expect(editorProps.onApplyFeeInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        customFeeInfo: expect.objectContaining({
          common: zeroFee.common,
          gas: expect.objectContaining({ gasLimit: '21000', gasPrice: '2' }),
        }),
      }),
    );
  });

  it('accepts the maximum supported precision and preserves base units', async () => {
    const maxPrecisionFee: IFeeInfoUnit = {
      common: { ...common, feeDecimals: 24 },
      feeNeoN3: {
        systemFee: '1000000000000000000000000',
        networkFee: '2000000000000000000000000',
        priorityFee: '3000000000000000000000000',
      },
    };
    const editorProps = props(maxPrecisionFee);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...editorProps} />);
    });
    const formDefaults = latestForm().watch();
    expect(formDefaults.neoN3SystemFee).toBe('1');
    expect(formDefaults.neoN3NetworkFee).toBe('2');
    expect(formDefaults.neoN3PriorityFee).toBe('3');
    await act(async () => {
      if (tree) await pressSave(tree);
    });
    expect(editorProps.onApplyFeeInfo).toHaveBeenCalledWith(
      expect.objectContaining({ customFeeInfo: maxPrecisionFee }),
    );
  });

  it('converts NeoN3 base units and saves them without changing units', async () => {
    const editorProps = props(neoFee);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...editorProps} />);
    });
    const formDefaults = latestForm().watch();
    expect(formDefaults.neoN3SystemFee).toBe('1');
    expect(formDefaults.neoN3NetworkFee).toBe('2');
    expect(formDefaults.neoN3PriorityFee).toBe('3');
    await act(async () => {
      latestForm().setValue('neoN3SystemFee', '4.5');
    });
    const save = tree?.root.findByProps({ testID: 'signature-confirm-btn' });
    expect(save?.props.disabled).toBe(false);
    await act(async () => {
      if (tree) await pressSave(tree);
    });
    expect(editorProps.onApplyFeeInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        customFeeInfo: expect.objectContaining({
          common,
          feeNeoN3: {
            systemFee: '450000000',
            networkFee: '200000000',
            priorityFee: '300000000',
          },
        }),
      }),
    );
  });

  it('unmounts invalid fees and remounts cleanly when they become valid', async () => {
    const valid = props(neoFee);
    const invalid = props({ common: {} } as IFeeInfoUnit);
    const updated = props({
      ...neoFee,
      feeNeoN3: {
        systemFee: '900000000',
        networkFee: '200000000',
        priorityFee: '300000000',
      },
    });
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...invalid} />);
    });
    expectFeeError(tree);
    await act(async () => {
      tree?.update(<TxFeeEditor {...valid} />);
    });
    expect(
      tree?.root.findByProps({ testID: 'signature-confirm-btn' }),
    ).toBeDefined();
    await act(async () => {
      latestForm().setValue('neoN3SystemFee', '4');
    });
    expect(latestForm().watch().neoN3SystemFee).toBe('4');
    await act(async () => {
      tree?.update(<TxFeeEditor {...updated} />);
    });
    expect(latestForm().watch().neoN3SystemFee).toBe('4');
    await act(async () => {
      tree?.update(<TxFeeEditor {...invalid} />);
    });
    expectFeeError(tree);
    await act(async () => {
      tree?.update(<TxFeeEditor {...updated} />);
    });
    expect(latestForm().watch().neoN3SystemFee).toBe('9');
    expect(
      tree?.root.findByProps({ testID: 'signature-confirm-btn' }),
    ).toBeDefined();
    await act(async () => {
      if (tree) await pressSave(tree);
    });
    expect(updated.onApplyFeeInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        customFeeInfo: expect.objectContaining({
          feeNeoN3: expect.objectContaining({ systemFee: '900000000' }),
        }),
      }),
    );
  });

  it('uses selected fee only when original fee is absent', async () => {
    const editorProps = {
      ...props(undefined),
      selectedFee: selectedFee(neoFee),
    };
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...editorProps} />);
    });
    expect(
      tree?.root.findByProps({ testID: 'signature-confirm-btn' }),
    ).toBeDefined();

    await act(async () => {
      tree?.update(
        <TxFeeEditor
          {...editorProps}
          originalCustomFee={{ common: {} } as IFeeInfoUnit}
        />,
      );
    });
    expectFeeError(tree);
  });
});

// TxFeeInfo gives the only base-fee fallback item value 1, and Custom,
// appended after it, gets value items.length, which is 1 too.
const fallbackFeeSelectorItems: IFeeSelectorItem[] = [
  {
    label: 'Normal',
    icon: '',
    value: 1,
    feeInfo: { common: evmFee.common },
    type: EFeeType.Standard,
  },
  {
    label: 'Custom',
    icon: '',
    value: 1,
    feeInfo: { common: evmFee.common },
    type: EFeeType.Custom,
  },
];

function getSegmentControlProps() {
  const segmentProps = mockSegmentControl.mock.lastCall?.[0];
  expect(segmentProps).toBeDefined();
  return segmentProps as ISegmentControlProps;
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
  let tree: ReturnType<typeof create> | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest
      .mocked(useForm)
      .mockImplementation(
        jest.requireActual<typeof import('react-hook-form')>('react-hook-form')
          .useForm,
      );
    // The real form validates on mount and settles its state a tick later.
    await act(async () => {
      tree = create(
        <TxFeeEditor
          networkId="evm--1"
          feeSelectorItems={fallbackFeeSelectorItems}
          sendSelectedFee={{ feeType: EFeeType.Standard, presetIndex: 0 }}
          originalCustomFee={{ common: evmFee.common }}
          selectedFee={undefined}
          unsignedTxs={[{} as IUnsignedTxPro]}
          onApplyFeeInfo={jest.fn()}
        />,
      );
    });
  });

  afterEach(async () => {
    await act(async () => {
      tree?.unmount();
    });
  });

  it('selects the fallback item, and only it, on open', () => {
    expect(getSelectedFeeTypes()).toEqual([EFeeType.Standard]);
  });

  it('selects the item that was pressed', () => {
    pressOption(1);
    expect(getSelectedFeeTypes()).toEqual([EFeeType.Custom]);

    pressOption(0);
    expect(getSelectedFeeTypes()).toEqual([EFeeType.Standard]);
  });
});
