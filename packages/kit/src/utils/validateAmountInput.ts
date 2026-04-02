export function validateAmountInput(text: string, decimal?: number) {
  const regex = new RegExp(
    `^$|^0(\\.\\d{0,${decimal ?? 6}})?$|^[1-9]\\d*(\\.\\d{0,${
      decimal ?? 6
    }})?$|^[1-9]\\d*\\.$|^0\\.$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
}

export function validateAmountInputForStaking(text: string, decimal?: number) {
  // Matches: empty | 0 | 0.xxx | [1-9]xxx | [1-9]xxx.xxx | [1-9]xxx. | 0. | .xxx
  // Does NOT match leading zeros like "0099" (same as validateAmountInput but also supports ".xxx")
  const regex = new RegExp(
    `^$|^0(\\.\\d{0,${decimal ?? 6}})?$|^[1-9]\\d*(\\.\\d{0,${
      decimal ?? 6
    }})?$|^[1-9]\\d*\\.$|^0\\.$|^\\.\\d{0,${decimal ?? 6}}$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
}
