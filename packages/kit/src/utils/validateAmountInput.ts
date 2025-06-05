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
  const regex = new RegExp(
    `^$|^[0-9]\\d*(\\.\\d{0,${decimal ?? 6}})?$|^[0-9]\\d*\\.$|^\\.\\d{0,${
      decimal ?? 6
    }}$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
}
