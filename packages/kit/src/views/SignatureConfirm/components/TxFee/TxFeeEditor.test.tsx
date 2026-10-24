import React from 'react';

import { act, create } from 'react-test-renderer';

import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { EFeeType } from '@onekeyhq/shared/types/fee';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

import { TxFeeEditor } from './TxFeeEditor';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Host = ({
    children,
    ...hostProps
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('mock-view', hostProps, children);
  const Form = Object.assign(Host, { Field: Host });
  return {
    Alert: Host,
    Button: Host,
    Checkbox: Host,
    Form,
    Input: Host,
    NumberSizeableText: Host,
    ScrollView: Host,
    SegmentControl: Host,
    SizableText: Host,
    Stack: Host,
    XStack: Host,
    YStack: Host,
    useDialogInstance: () => ({ close: async () => {} }),
    useForm: jest.fn(
      ({ defaultValues }: { defaultValues: Record<string, string> }) => {
        const [values, setValues] = React.useState(defaultValues);
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
  ])('does not mount form or save for %s', async (_, fee) => {
    const unsafeProps = props(fee as IFeeInfoUnit | undefined);
    let tree: ReturnType<typeof create> | undefined;
    await act(async () => {
      tree = create(<TxFeeEditor {...unsafeProps} />);
    });
    expect(tree?.toJSON()).toBeNull();
    expect(useForm).not.toHaveBeenCalled();
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
    expect(tree?.toJSON()).toBeNull();
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
    expect(tree?.toJSON()).toBeNull();
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
    expect(tree?.toJSON()).toBeNull();
  });
});
