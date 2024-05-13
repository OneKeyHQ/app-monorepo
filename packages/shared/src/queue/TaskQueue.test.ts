import timerUtils from '../utils/timerUtils';

import { TaskQueue } from './TaskQueue';

describe('TaskQueue', () => {
  test('should process tasks in the correct order', async () => {
    const queue = new TaskQueue(1);
    const output: string[] = [];

    void queue.add(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(output.push('first')), 50),
        ),
    );
    void queue.add(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(output.push('second')), 30),
        ),
    );
    void queue.add(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(output.push('third')), 10),
        ),
    );

    await timerUtils.wait(200); // Wait for all tasks to complete
    expect(output).toEqual(['first', 'second', 'third']);
  });

  test('should respect concurrency limits', async () => {
    const queue = new TaskQueue(2);
    let running = 0;
    let maxRunning = 0;

    const trackTask = () =>
      new Promise((resolve) => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        setTimeout(() => {
          running -= 1;
          resolve(true);
        }, 200);
      });

    void queue.add(trackTask);
    void queue.add(trackTask);
    void queue.add(trackTask);

    await timerUtils.wait(350);
    expect(maxRunning).toBe(2);
  });

  test('should handle errors without stopping the queue', async () => {
    const queue = new TaskQueue(1);
    const errorTask = queue.add(() => Promise.reject(new Error('Oops')));
    const successTask = queue.add(() => Promise.resolve('Success'));

    await expect(errorTask).rejects.toThrow('Oops');
    await expect(successTask).resolves.toBe('Success');
  });

  test('should return correct results from tasks', async () => {
    const queue = new TaskQueue(1);

    const result1 = queue.add(() => Promise.resolve(10));
    const result2 = queue.add(() => Promise.resolve(20));

    expect(await result1).toBe(10);
    expect(await result2).toBe(20);
  });

  test('should return correct results from tasks, including complex data and handle errors', async () => {
    const queue = new TaskQueue(1);

    const complexData = { key: 'value', items: [1, 2, 3] };
    const moreComplexData = { user: { id: 1, name: 'Test User' }, valid: true };

    const result1 = queue.add(() => Promise.resolve(10));
    const result2 = queue.add(() => Promise.resolve(complexData));
    const result3 = queue.add(() => Promise.resolve(moreComplexData));
    const result4 = queue.add(() =>
      Promise.reject(new Error('Intentional Error')),
    );

    await expect(result1).resolves.toBe(10);
    await expect(result2).resolves.toEqual(complexData);
    await expect(result3).resolves.toEqual(moreComplexData);
    await expect(result4).rejects.toThrow('Intentional Error');
  });
});
