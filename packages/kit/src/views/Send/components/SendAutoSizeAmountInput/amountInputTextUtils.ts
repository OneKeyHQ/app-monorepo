export function sanitizeAmountInputText(text: string): string {
  let sanitizedText = text
    .replace(/[。,，,]/g, '.')
    .replace(/\s/g, '')
    .replace(/[^\d.]/g, '');

  if (sanitizedText.startsWith('.')) {
    sanitizedText = `0${sanitizedText}`;
  }

  if (
    sanitizedText.length > 1 &&
    sanitizedText.startsWith('0') &&
    !sanitizedText.startsWith('0.')
  ) {
    sanitizedText = sanitizedText.replace(/^0+/, '') || '0';
    if (sanitizedText.startsWith('.')) {
      sanitizedText = `0${sanitizedText}`;
    }
  }

  const firstDecimalIndex = sanitizedText.indexOf('.');
  if (firstDecimalIndex !== -1) {
    const integerPart = sanitizedText.slice(0, firstDecimalIndex + 1);
    const decimalPart = sanitizedText
      .slice(firstDecimalIndex + 1)
      .replace(/\./g, '');
    sanitizedText = `${integerPart}${decimalPart}`;
  }

  return sanitizedText;
}

export type IAmountInputCharacter = {
  id: number;
  char: string;
  entering: boolean;
};

export type IAmountInputCharacters = {
  text: string;
  characters: IAmountInputCharacter[];
  nextId: number;
};

export function createAmountInputCharacters(
  text: string,
): IAmountInputCharacters {
  return {
    text,
    characters: Array.from(text, (char, id) => ({ id, char, entering: false })),
    nextId: text.length,
  };
}

// Preserve the untouched prefix/suffix when inserting, deleting or replacing
// text. Numeric place-value keys would animate every digit while typing "12".
export function updateAmountInputCharacters(
  previous: IAmountInputCharacters,
  text: string,
): IAmountInputCharacters {
  let start = 0;
  while (
    start < previous.text.length &&
    start < text.length &&
    previous.text[start] === text[start]
  )
    start += 1;
  let end = 0;
  while (
    end < previous.text.length - start &&
    end < text.length - start &&
    previous.text[previous.text.length - end - 1] ===
      text[text.length - end - 1]
  )
    end += 1;
  let nextId = previous.nextId;
  const inserted = Array.from(text.slice(start, text.length - end), (char) => {
    const character = { id: nextId, char, entering: true };
    nextId += 1;
    return character;
  });
  return {
    text,
    nextId,
    characters: [
      ...previous.characters.slice(0, start),
      ...inserted,
      ...(end ? previous.characters.slice(-end) : []),
    ],
  };
}
