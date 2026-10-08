import { PrimeTransferPreparation } from './PrimeTransferPreparation';

test('empty work and out-of-order completions never regress or finish preparation early', async () => {
  const values: number[] = [];
  const task = new PrimeTransferPreparation(
    'fixture-task',
    async ({ percentage }) => {
      values.push(percentage);
    },
  );
  await task.update('accounts', 0);
  await task.update('accounts', 50, 100);
  await task.update('credentials', 0, 0);
  await task.update('accounts');
  await task.update('wallets', 0, 0);
  await task.update('decrypting');
  await task.update('serializing');
  expect(values).toEqual([...values].toSorted((a, b) => a - b));
  expect(Math.max(...values)).toBeLessThan(100);
  await task.update('encrypting');
  expect(values.at(-1)).toBe(100);
});

test('cancellation during publication prevents continuing preparation', async () => {
  const task = new PrimeTransferPreparation('fixture-task', async () => {
    task.cancel();
  });
  await expect(task.update('accounts', 0)).rejects.toThrow(
    'Transfer cancelled',
  );
  await expect(task.update('encrypting')).rejects.toThrow('Transfer cancelled');
});
