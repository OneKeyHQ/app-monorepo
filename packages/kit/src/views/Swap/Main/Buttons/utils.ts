export type Task = (nextTask?: () => Promise<void>) => Promise<void>;

export async function combinedTasks(tasks: Task[]) {
  let index = 0;

  async function next() {
    if (index < tasks.length) {
      const callback = tasks[index];
      index += 1;
      await callback(next);
    }
  }

  await next();
}