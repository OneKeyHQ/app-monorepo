export type IPrimeTransferVerificationCodeFailureReason =
  | 'invalid-user-part'
  | 'invalid-random-number'
  | 'repeated-digits';

export type IPrimeTransferVerificationCodeResult =
  | { ok: true; code: string }
  | {
      ok: false;
      reason: IPrimeTransferVerificationCodeFailureReason;
    };

const SIX_DIGIT_NUMBER_RE = /^\d{6}$/;

function isRepeatedDigits(code: string): boolean {
  const firstDigit = code[0];
  return code.split('').every((digit) => digit === firstDigit);
}

export function buildPrimeTransferVerificationCode({
  userPart,
  randomNumber,
}: {
  userPart: string;
  randomNumber: string;
}): IPrimeTransferVerificationCodeResult {
  if (!SIX_DIGIT_NUMBER_RE.test(userPart)) {
    return { ok: false, reason: 'invalid-user-part' };
  }

  if (!SIX_DIGIT_NUMBER_RE.test(randomNumber)) {
    return { ok: false, reason: 'invalid-random-number' };
  }

  const code = userPart
    .split('')
    .map((digit, index) => {
      const userDigit = Number.parseInt(digit, 10);
      const randomDigit = Number.parseInt(randomNumber[index] ?? '0', 10);
      return (userDigit + randomDigit) % 10;
    })
    .join('');

  if (isRepeatedDigits(code)) {
    return { ok: false, reason: 'repeated-digits' };
  }

  return { ok: true, code };
}
