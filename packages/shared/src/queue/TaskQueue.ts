/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Mutex } from 'async-mutex';

// Define Task type as a function returning a Promise of type T
type ITask<T> = () => Promise<T>;

class TaskQueue {
  private concurrency: number; // Limit for concurrent tasks

  // Mutex for locking task execution
  private mutex?: Mutex;

  private tasks: Array<{
    task: ITask<any>;
    resolve: any;
    reject: any;
  }>;

  // Currently active tasks count
  private activeCount: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.tasks = [];
    this.activeCount = 0;
    // Initialize the mutex only when concurrency is 1
    if (concurrency === 1) {
      this.mutex = new Mutex();
    }
  }

  // Add a task to the queue and return a promise that resolves with the result of the task
  add<T>(task: ITask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.tasks.push({ task, resolve, reject });
      void this.next();
    });
  }

  // Attempt to execute the next task in the queue
  private async next(): Promise<void> {
    if (this.activeCount >= this.concurrency || this.tasks.length === 0) {
      return;
    }

    this.activeCount += 1;
    const taskEntry = this.tasks.shift();

    if (!taskEntry) {
      return;
    }

    const { task, resolve, reject } = taskEntry;
    const release = this.mutex ? await this.mutex.acquire() : null;
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error); // If the task fails, reject the original promise
    } finally {
      if (release) {
        release();
      }
      this.activeCount -= 1;
      void this.next();
    }
  }
}

export { TaskQueue };
