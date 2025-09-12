import { convertLtcXpub } from '.';

const convertLtcXpubTestCases = [
  {
    purpose: "44'",
    xpub: 'Ltub2YYecr1EWBPtSQsF6KvyQ62fetqpG3ptF9tMCHo2qWcQRLFhsm2N7wpnCsXrY5CxSvnMXkxpw3ja7YPwUkGppQFf1EQBSCR7nufxZkbeGNH',
    expected:
      'Ltub2YYecr1EWBPtSQsF6KvyQ62fetqpG3ptF9tMCHo2qWcQRLFhsm2N7wpnCsXrY5CxSvnMXkxpw3ja7YPwUkGppQFf1EQBSCR7nufxZkbeGNH',
  },
  {
    purpose: "48'",
    xpub: 'Ltub2Yx3Zi4MYz9BDF5g1CtREi4KPvrUq4MBKAvwzEPMdASY6FCwWXiEfBiUywks8qxhD792mBkFHxs6zDtMW9jZtTdf8aUqWmkRN4ScCNnoz9a',
    expected:
      'Ltub2Yx3Zi4MYz9BDF5g1CtREi4KPvrUq4MBKAvwzEPMdASY6FCwWXiEfBiUywks8qxhD792mBkFHxs6zDtMW9jZtTdf8aUqWmkRN4ScCNnoz9a',
  },
  {
    purpose: "49'",
    xpub: 'Ltub2ZjUF4oMpXrWHAkE6qabBvk7tzNaBT7VEHfHEEMtuD7scjXDeXn1KyRDebMiewtpTRb4A6tQAg8tqnRqmDVzZX2JYtaZJAwSrmL4dykbt2D',
    expected:
      'Mtub2tZjYjUGyDPz8TwLwCNDQ1qd4xX2856z9QBW1dFnHDVkfqLSuBwZx35MfoKJerYjs4hruaUxdLVSj53QUuv1MkhuREGyt5kw8VPi2VwQWko',
  },
  {
    purpose: "84'",
    xpub: 'Ltub2ZwewHnM43H1RLMQ7pkYPtW8ZmPWvpurGZZshtkQHSKVHuoBmht3fSPYmgALAjsU2Pt4TE1ZwXhbJcAAYefwP6pKiKE5cRYa3CKrFyELUhd',
    expected:
      'zpub6sB55yv9Ty3xsZThC4KnxCaupuMr4HNhyWQLSbo4fxEYfjnqd1iS5vDPTDZUW9n4FTi6N3p91pmJy62B59QX8eQ79rjU7ZRW69go8cLh54i',
  },
];

describe('BTC SDK tests', () => {
  it('convertLtcXpub test', async () => {
    for (const testCase of convertLtcXpubTestCases) {
      const result = await convertLtcXpub({
        purpose: testCase.purpose,
        xpub: testCase.xpub,
      });
      expect(result).toBe(testCase.expected);
    }
  });
});
