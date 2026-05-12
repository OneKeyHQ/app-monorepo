import { execFile, spawn } from 'node:child_process';

import type { IProcessRunner } from './types';

export const defaultProcessRunner: IProcessRunner = {
  execFileAsync(cmd, args) {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, (error, stdout, stderr) => {
        if (error) {
          (error as Error & { stderr?: string }).stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  },

  spawnWithStdin(cmd, args, input) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(
            `Process exited with code ${code}`,
          ) as Error & {
            code?: number;
            stderr?: string;
          };
          error.code = code ?? 1;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });

      child.stdin.write(`${input}\n`);
      child.stdin.end();
    });
  },
};
