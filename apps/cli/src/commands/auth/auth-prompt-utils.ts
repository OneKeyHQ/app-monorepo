import { createInterface } from 'node:readline';

export function readConfirmation(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
