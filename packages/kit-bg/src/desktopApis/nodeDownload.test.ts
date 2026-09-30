import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';

// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import { downloadNodeFile } from './nodeDownload';

import type { AddressInfo } from 'net';

const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
  days: 1,
  keySize: 2048,
});

describe('nodeDownload', () => {
  let dir: string;
  let priorTls: boolean | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-node-download-'));
    priorTls = https.globalAgent.options.rejectUnauthorized;
    https.globalAgent.options.rejectUnauthorized = false;
  });

  afterEach(() => {
    https.globalAgent.options.rejectUnauthorized = priorTls;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('assembles eight ranges and checks SHA-512 before promotion', async () => {
    const content = crypto.randomBytes(3 * 1024 * 1024);
    const ranges: string[] = [];
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        const raw = req.headers.range;
        if (!raw) {
          res.writeHead(200, { 'Content-Length': content.length });
          res.end(content);
          return;
        }
        ranges.push(raw);
        const match = /^bytes=(\d+)-(\d+)$/.exec(raw);
        if (!match) {
          res.writeHead(416);
          res.end();
          return;
        }
        const start = Number(match[1]);
        const end = Number(match[2]);
        res.writeHead(206, {
          ETag: '"range-v1"',
          'Content-Range': `bytes ${start}-${end}/${content.length}`,
          'Content-Length': end - start + 1,
        });
        res.end(content.subarray(start, end + 1));
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const targetPath = path.join(dir, 'nested', 'installer.zip');
      const result = await downloadNodeFile({
        url: `https://localhost:${port}/installer.zip`,
        targetPath,
        identity: 'mac-arm64:1.2.3',
        expectedSha512: crypto
          .createHash('sha512')
          .update(content)
          .digest('base64'),
      });
      expect(result.totalBytes).toBe(content.length);
      expect(fs.readFileSync(targetPath).equals(content)).toBe(true);
      expect(ranges.length).toBeGreaterThanOrEqual(9);
      expect(fs.existsSync(`${targetPath}.partial.progress.json`)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('rejects an unknown-length body beyond the feed size', async () => {
    const content = Buffer.from('unexpectedly long body');
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (_req, res) => {
        res.write(content);
        res.end();
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      await expect(
        downloadNodeFile({
          url: `https://localhost:${port}/installer.zip`,
          targetPath: path.join(dir, 'installer.zip'),
          identity: 'oversize',
          expectedBytes: 4,
          expectedSha512: crypto
            .createHash('sha512')
            .update(content)
            .digest('base64'),
        }),
      ).rejects.toThrow('Download body exceeds expected size');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('resumes only unfinished ranges after an interrupted parallel download', async () => {
    const content = crypto.randomBytes(3 * 1024 * 1024);
    const secondRunRanges: string[] = [];
    let secondRun = false;
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        const raw = req.headers.range;
        const match = /^bytes=(\d+)-(\d+)$/.exec(raw ?? '');
        if (!match) {
          res.writeHead(200, { 'Content-Length': content.length });
          res.end(content);
          return;
        }
        const start = Number(match[1]);
        const end = Number(match[2]);
        res.writeHead(206, {
          ETag: '"parallel-v1"',
          'Content-Range': `bytes ${start}-${end}/${content.length}`,
          'Content-Length': end - start + 1,
        });
        if (secondRun && raw !== 'bytes=0-0') secondRunRanges.push(raw!);
        const send = () => res.end(content.subarray(start, end + 1));
        if (!secondRun && start > 0) {
          setTimeout(() => res.destroy(), 20);
        } else {
          send();
        }
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const targetPath = path.join(dir, 'installer.zip');
      const opts = {
        url: `https://localhost:${port}/installer.zip`,
        targetPath,
        identity: 'mac-arm64:2.0.0',
        expectedSha512: crypto
          .createHash('sha512')
          .update(content)
          .digest('hex'),
      };
      await expect(downloadNodeFile(opts)).rejects.toThrow();

      const manifestPath = `${targetPath}.partial.progress.json`;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        mode: string;
        parts: Array<{ start: number; end: number; done: number }>;
      };
      expect(manifest.mode).toBe('parallel');
      expect(manifest.parts.some((part) => part.done > 0)).toBe(true);
      expect(
        manifest.parts.some((part) => part.done < part.end - part.start + 1),
      ).toBe(true);
      const expectedRanges = manifest.parts
        .filter((part) => part.done < part.end - part.start + 1)
        .map((part) => `bytes=${part.start + part.done}-${part.end}`)
        .toSorted();

      secondRun = true;
      await downloadNodeFile(opts);
      expect(secondRunRanges.toSorted()).toEqual(expectedRanges);
      expect(fs.readFileSync(targetPath).equals(content)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('restarts all ranges when the object ETag changes', async () => {
    const oldContent = crypto.randomBytes(3 * 1024 * 1024);
    const content = crypto.randomBytes(oldContent.length);
    const expectedSha512 = crypto
      .createHash('sha512')
      .update(content)
      .digest('hex');
    const newRanges: string[] = [];
    let changed = false;
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        const active = changed ? content : oldContent;
        const raw = req.headers.range;
        const match = /^bytes=(\d+)-(\d+)$/.exec(raw ?? '');
        if (!match) {
          res.writeHead(200, { 'Content-Length': active.length });
          res.end(active);
          return;
        }
        const start = Number(match[1]);
        const end = Number(match[2]);
        res.writeHead(206, {
          ETag: changed ? '"object-v2"' : '"object-v1"',
          'Content-Range': `bytes ${start}-${end}/${active.length}`,
          'Content-Length': end - start + 1,
        });
        if (changed && raw !== 'bytes=0-0') newRanges.push(raw!);
        if (!changed && start > 0) {
          setTimeout(() => res.destroy(), 20);
        } else {
          res.end(active.subarray(start, end + 1));
        }
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const targetPath = path.join(dir, 'installer.zip');
      const url = `https://localhost:${port}/installer.zip`;
      await expect(
        downloadNodeFile({
          url,
          targetPath,
          identity: 'mac-arm64:2.1.0',
          expectedSha512,
        }),
      ).rejects.toThrow();
      expect(fs.existsSync(`${targetPath}.partial.progress.json`)).toBe(true);

      changed = true;
      await downloadNodeFile({
        url,
        targetPath,
        identity: 'mac-arm64:2.1.0',
        expectedSha512,
      });
      expect(newRanges).toHaveLength(8);
      expect(newRanges).toContain(
        `bytes=0-${Math.ceil(content.length / 8) - 1}`,
      );
      expect(fs.readFileSync(targetPath).equals(content)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('keeps a cancelled single stream and resumes only missing bytes', async () => {
    const content = crypto.randomBytes(512 * 1024);
    const ranges: string[] = [];
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        const raw = req.headers.range;
        if (raw) ranges.push(raw);
        const start = /^bytes=(\d+)-$/.exec(raw ?? '');
        const offset = start ? Number(start[1]) : 0;
        res.writeHead(start ? 206 : 200, {
          ETag: '"single-v1"',
          'Content-Length': content.length - offset,
          ...(start
            ? {
                'Content-Range': `bytes ${offset}-${content.length - 1}/${content.length}`,
              }
            : {}),
        });
        let cursor = offset;
        const write = () => {
          if (res.destroyed || cursor >= content.length) {
            res.end();
            return;
          }
          const end = Math.min(cursor + 16 * 1024, content.length);
          res.write(content.subarray(cursor, end));
          cursor = end;
          setImmediate(write);
        };
        write();
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const targetPath = path.join(dir, 'installer.exe');
      const opts = {
        url: `https://localhost:${port}/installer.exe`,
        targetPath,
        identity: 'win-x64:1.2.3',
        expectedSha512: crypto
          .createHash('sha512')
          .update(content)
          .digest('hex'),
      };
      const controller = new AbortController();
      await expect(
        downloadNodeFile({
          ...opts,
          signal: controller.signal,
          onProgress: ({ transferred }) => {
            if (transferred >= 16 * 1024) controller.abort();
          },
        }),
      ).rejects.toThrow();
      expect(fs.existsSync(`${targetPath}.partial`)).toBe(true);
      expect(fs.existsSync(`${targetPath}.partial.progress.json`)).toBe(true);
      await downloadNodeFile(opts);
      expect(fs.readFileSync(targetPath).equals(content)).toBe(true);
      expect(ranges.some((range) => /^bytes=[1-9]\d*-$/.test(range))).toBe(
        true,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('drops private headers when redirected to another origin', async () => {
    const content = Buffer.from('signed installer bytes');
    const seen: Array<{ authorization?: string; agent?: string }> = [];
    const target = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        seen.push({
          authorization: req.headers.authorization,
          agent: req.headers['user-agent'],
        });
        res.writeHead(200, { 'Content-Length': content.length });
        res.end(content);
      },
    );
    await new Promise<void>((resolve) => target.listen(0, resolve));
    const targetPort = (target.address() as AddressInfo).port;
    const source = https.createServer(
      { key: pems.private, cert: pems.cert },
      (_req, res) => {
        res.writeHead(302, {
          Location: `https://localhost:${targetPort}/installer.zip`,
        });
        res.end();
      },
    );
    await new Promise<void>((resolve) => source.listen(0, resolve));
    try {
      const sourcePort = (source.address() as AddressInfo).port;
      await downloadNodeFile({
        url: `https://localhost:${sourcePort}/download`,
        targetPath: path.join(dir, 'installer.zip'),
        identity: 'mac-x64:1.2.3',
        headers: { Authorization: 'secret', 'User-Agent': 'OneKey-test' },
        expectedSha256: crypto
          .createHash('sha256')
          .update(content)
          .digest('hex'),
      });
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((entry) => entry.authorization === undefined)).toBe(
        true,
      );
      expect(seen.every((entry) => entry.agent === 'OneKey-test')).toBe(true);
    } finally {
      await new Promise<void>((resolve) => source.close(() => resolve()));
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  });

  test('uses single stream when a fresh range probe stays unavailable', async () => {
    const content = crypto.randomBytes(64 * 1024);
    let probes = 0;
    let fullGets = 0;
    const server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (req, res) => {
        if (req.headers.range === 'bytes=0-0') {
          probes += 1;
          res.writeHead(503);
          res.end();
          return;
        }
        fullGets += 1;
        res.writeHead(200, { 'Content-Length': content.length });
        res.end(content);
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const targetPath = path.join(dir, 'installer.AppImage');
      await downloadNodeFile({
        url: `https://localhost:${port}/installer.AppImage`,
        targetPath,
        identity: 'linux-x64:1.2.3',
        expectedSha512: crypto
          .createHash('sha512')
          .update(content)
          .digest('hex'),
      });
      expect(probes).toBe(4);
      expect(fullGets).toBe(1);
      expect(fs.readFileSync(targetPath).equals(content)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 15_000);
});
