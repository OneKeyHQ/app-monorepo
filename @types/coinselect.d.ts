// TODO: remove this file to @onekeyfe/coinselect
declare module '@onekeyfe/coinselect' {
  export interface ICoinSelectInput {
    txId: string;
    vout: number;
    value: number;
    script?: string;
    nonWitnessUtxo?: Buffer;
    witnessUtxo?: {
      script: Buffer;
      value: number;
    };
    forceSelect?: boolean;
  }
  export interface ICoinSelectOutput {
    address?: string;
    value?: number;
    script?: string;
  }
  export interface ICoinSelectResult {
    inputs?: ICoinSelectInput[];
    outputs?: ICoinSelectOutput[];
    fee?: number;
  }

  export default function coinselect(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}

declare module '@onekeyfe/coinselect/split' {
  import type {
    ICoinSelectInput,
    ICoinSelectOutput,
    ICoinSelectResult,
  } from 'coinselect';

  export default function split(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}

declare module '@onekeyfe/coinselect/accumulative' {
  import type {
    ICoinSelectInput,
    ICoinSelectOutput,
    ICoinSelectResult,
  } from 'coinselect';

  export default function accumulative(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}

declare module '@onekeyfe/coinselect/break' {
  import type {
    ICoinSelectInput,
    ICoinSelectOutput,
    ICoinSelectResult,
  } from 'coinselect';

  export default function breakFn(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}

declare module '@onekeyfe/coinselect/blackjack' {
  import type {
    ICoinSelectInput,
    ICoinSelectOutput,
    ICoinSelectResult,
  } from 'coinselect';

  export default function blackjack(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}

declare module '@onekeyfe/coinselect/utils' {
  import type {
    ICoinSelectInput,
    ICoinSelectOutput,
    ICoinSelectResult,
  } from 'coinselect';

  export function uintOrNaN(value: number): number;
  export function sumOrNaN(outputs: ICoinSelectOutput[]): number;
  export function inputBytes(input: ICoinSelectInput): number;
  export function dustThreshold(
    output: Partial<ICoinSelectOutput>,
    feeRate: number,
  ): number;
  export function transactionBytes(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
  ): number;
  export function finalize(
    inputs: ICoinSelectInput[],
    outputs: ICoinSelectOutput[],
    feeRate: number,
  ): ICoinSelectResult;
}
