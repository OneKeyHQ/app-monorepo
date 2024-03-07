declare module 'coinselect' {
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

declare module 'coinselect/split' {
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

declare module 'coinselect/accumulative' {
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

declare module 'coinselect/break' {
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

declare module 'coinselect/blackjack' {
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

declare module 'coinselect/utils' {
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
