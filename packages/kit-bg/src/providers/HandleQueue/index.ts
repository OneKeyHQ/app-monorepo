class Queue {
  private tasks: (() => Promise<any>)[] = [];

  public enqueue(task: () => Promise<any>) {
    this.tasks.push(task);
    if (this.tasks.length === 1) {
      this.dequeue();
    }
  }

  private async dequeue() {
    while (this.tasks.length > 0) {
      const task = this.tasks[0];
      await task();
      this.tasks.shift();
    }
  }
}

export const queue = new Queue();
