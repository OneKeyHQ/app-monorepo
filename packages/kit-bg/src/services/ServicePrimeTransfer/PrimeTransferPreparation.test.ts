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

async function publishedMilestones(
  setup: (task: PrimeTransferPreparation) => void,
  stages: Parameters<PrimeTransferPreparation['update']>[0][],
) {
  const values: number[] = [];
  const task = new PrimeTransferPreparation(
    'fixture-task',
    async ({ percentage }) => {
      values.push(percentage);
    },
  );
  await task.update('accounts', 0);
  await task.update('accounts');
  await task.update('credentials');
  await task.update('wallets');
  setup(task);
  for (const stage of stages) {
    await task.update(stage);
  }
  return values;
}

test('collecting existing records takes 10%, leaving the rest to credential work', async () => {
  expect(
    await publishedMilestones(
      () => undefined,
      ['decrypting', 'wrappingCredentials', 'serializing', 'encrypting'],
    ),
  ).toEqual([0, 5, 7, 10, 80, 90, 95, 100]);
});

test.each([
  {
    path: 'legacy peer',
    stages: [
      'decrypting',
      'wrappingCredentials',
      'legacyCredentials',
      'serializing',
      'encrypting',
    ] as const,
    expected: [49, 55, 94, 97, 100],
  },
  {
    path: 'watching only',
    stages: ['serializing', 'encrypting'] as const,
    expected: [55, 100],
  },
  {
    path: 'CLI bot wallet',
    stages: ['decrypting', 'serializing', 'encrypting'] as const,
    expected: [88, 94, 100],
  },
])(
  'the $path path spreads the remaining 90% over the stages it runs',
  async ({ stages, expected }) => {
    expect(
      await publishedMilestones(
        (task) => task.setPayloadStages([...stages]),
        [...stages],
      ),
    ).toEqual([0, 5, 7, 10, ...expected]);
  },
);

test('a stage outside the planned path publishes nothing', async () => {
  expect(
    await publishedMilestones(
      () => undefined,
      ['legacyCredentials', 'decrypting'],
    ),
  ).toEqual([0, 5, 7, 10, 80]);
});

test('each executed stage starts where the previous one ended', async () => {
  const values: number[] = [];
  const task = new PrimeTransferPreparation(
    'fixture-task',
    async ({ percentage }) => {
      values.push(percentage);
    },
  );
  task.setPayloadStages([
    'decrypting',
    'wrappingCredentials',
    'legacyCredentials',
    'serializing',
    'encrypting',
  ]);
  await task.update('wallets');
  await task.update('decrypting', 0, 4);
  await task.update('decrypting');
  await task.update('wrappingCredentials');
  await task.update('legacyCredentials', 0, 4);
  expect(values).toEqual([10, 10, 49, 55, 55]);
});
