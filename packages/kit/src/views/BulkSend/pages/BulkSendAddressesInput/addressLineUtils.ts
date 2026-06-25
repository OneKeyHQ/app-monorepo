import { EReceiverMode } from '@onekeyhq/shared/types/bulkSend';

type IValidAddressOnlyLine = {
  isValid: true;
  mode: EReceiverMode.AddressOnly;
  address: string;
  amount?: undefined;
};

type IValidAddressAndAmountLine = {
  isValid: true;
  mode: EReceiverMode.AddressAndAmount;
  address: string;
  amount: string;
};

type IInvalidAddressAndAmountLine = {
  isValid: false;
  mode: EReceiverMode.AddressAndAmount;
};

export type IBulkSendParsedAddressLine =
  | IValidAddressOnlyLine
  | IValidAddressAndAmountLine
  | IInvalidAddressAndAmountLine;

export type IBulkSendParsedAddressInputLine = {
  address: string;
  amount?: string;
};

function buildAddressAndAmountLine(
  parts: string[],
): IValidAddressAndAmountLine | IInvalidAddressAndAmountLine {
  if (parts.length !== 2) {
    return {
      isValid: false,
      mode: EReceiverMode.AddressAndAmount,
    };
  }

  const [address, amount] = parts.map((part) => part.trim());
  if (!address || !amount) {
    return {
      isValid: false,
      mode: EReceiverMode.AddressAndAmount,
    };
  }

  return {
    isValid: true,
    mode: EReceiverMode.AddressAndAmount,
    address,
    amount,
  };
}

export function parseBulkSendAddressLine(
  line: string,
): IBulkSendParsedAddressLine | undefined {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return undefined;
  }

  if (trimmedLine.includes(',')) {
    return buildAddressAndAmountLine(trimmedLine.split(','));
  }

  if (trimmedLine.includes('=')) {
    return buildAddressAndAmountLine(trimmedLine.split('='));
  }

  const whitespaceParts = trimmedLine.split(/\s+/);
  if (whitespaceParts.length === 1) {
    return {
      isValid: true,
      mode: EReceiverMode.AddressOnly,
      address: trimmedLine,
    };
  }

  return buildAddressAndAmountLine(whitespaceParts);
}

export function parseBulkSendAddressLines(
  value: string,
): IBulkSendParsedAddressInputLine[] {
  return value
    .split('\n')
    .reduce<IBulkSendParsedAddressInputLine[]>((result, line) => {
      const parsedLine = parseBulkSendAddressLine(line);
      if (!parsedLine) {
        return result;
      }

      if (parsedLine.isValid) {
        result.push(
          parsedLine.amount === undefined
            ? { address: parsedLine.address }
            : {
                address: parsedLine.address,
                amount: parsedLine.amount,
              },
        );
      } else {
        result.push({
          address: line.trim(),
        });
      }

      return result;
    }, []);
}

export function hasBulkSendAddressAmountLine(value: string) {
  return value
    .split('\n')
    .some(
      (line) =>
        parseBulkSendAddressLine(line)?.mode === EReceiverMode.AddressAndAmount,
    );
}
