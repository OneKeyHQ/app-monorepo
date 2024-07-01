import { spawn } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import stream from 'stream';
import { promisify } from 'util';

import AdmZip from 'adm-zip';
import Axios from 'axios';
import { dialog, ipcMain, shell } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';

import { ipcMessageKeys } from '../config';

import type { BrowserWindow } from 'electron';

const finished = promisify(stream.finished);

const ERRORS = {
  NOT_FOUND_DEVICE: 'NOT_FOUND_DEVICE',
  NOT_FOUND_DISK_PATH: 'NOT_FOUND_DISK_PATH',
  MAS_DISK_PATH_PERMISSION_DENIED: 'MAS_DISK_PATH_PERMISSION_DENIED',
  DISK_ACCESS_ERROR: 'DISK_ACCESS_ERROR',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
};

const MacVolumesPath = '/Volumes';
const MacDiskPath = path.join(MacVolumesPath, 'ONEKEY DATA');

const init = ({ mainWindow }: { mainWindow: BrowserWindow }) => {
  const getPlatform = () => {
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'win';
      default:
        return process.platform;
    }
  };

  const pollingDiskPathCanAccess = (diskPath: string) =>
    new Promise((resolve, reject) => {
      let tryCount = 0;
      const maxTryCount = 60;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const cleanTimer = () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };

      intervalId = setInterval(() => {
        logger.info(`access disk path, ${tryCount} try ===>`);
        fs.access(
          diskPath,
          // eslint-disable-next-line no-bitwise
          fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK,
          (err) => {
            if (err) {
              logger.error('disk access error =====> ', err);
              tryCount += 1;
              return;
            }
            cleanTimer();
            resolve(diskPath);
          },
        );

        if (tryCount >= maxTryCount) {
          cleanTimer();
          reject(new Error(ERRORS.DISK_ACCESS_ERROR));
        }
      }, 1000);
    });
  const findMacDiskPath = (): Promise<string> =>
    new Promise((resolve, reject) => {
      pollingDiskPathCanAccess(MacDiskPath)
        .then(() => {
          resolve(MacDiskPath);
        })
        .catch((err) => {
          logger.debug('mac disk access error =====> ', err);
          reject(err);
        });
    });

  const findWindowsDiskPath = async (): Promise<string> =>
    new Promise((resolve, reject) => {
      let tryCount = 0;
      const maxTryCount = 60;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const cleanTimer = () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };

      intervalId = setInterval(() => {
        logger.info(`find windows disk path, ${tryCount} try ===>`);

        try {
          const wmic = spawn('wmic', [
            'logicaldisk',
            'where',
            'drivetype=2',
            'get',
            'deviceid,volumename',
          ]);

          wmic.stdout.on('data', (buffer: Buffer) => {
            let data = buffer.toString('utf8');
            // logger.info('wmic stdout =====> ', data);
            data = data.replace(/DeviceID/g, '');
            data = data.replace(/VolumeName/g, '');
            const array = [...data].filter(
              (item) => item !== ' ' && item !== '\r' && item !== '\n',
            );
            const id: string[] = [];
            let name: string[] = [];
            const result: Record<string, string> = {};
            array.forEach((v, i) => {
              if (v === ':') {
                const key = array[i - 1];
                result[key] = '';
                if (id.length > 0) {
                  result[id[id.length - 1]] = name.join('');
                }
                id.push(key);
                name = [];
              } else {
                name.push(v);
              }
            });

            if (name.length > 0) {
              result[id[id.length - 1]] = name.join('');
            }

            logger.info(
              'find win disk path result =====> ',
              JSON.stringify(result),
            );

            const diskPath = Object.keys(result).find(
              (key) => result[key].indexOf('ONEKEYDATA') > -1,
            );
            if (diskPath) {
              cleanTimer();
              const WinDiskPath = `${diskPath}:`;
              pollingDiskPathCanAccess(WinDiskPath)
                .then(() => {
                  resolve(WinDiskPath);
                })
                .catch((err) => {
                  logger.debug('windows disk access error =====> ', err);
                  cleanTimer();
                  reject(err);
                });
            } else {
              tryCount += 1;
            }
          });

          wmic.stderr.on('data', (data: Buffer) => {
            tryCount += 1;
            logger.error(
              `wmin command failure, error ===> : ${data.toString('utf-8')}`,
            );
          });

          wmic.on('close', (code: string) => {
            tryCount += 1;
            logger.debug(`wmic command child process exited with code ${code}`);
          });
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger.debug(`wmic command child process executed error: ${e}`);
          tryCount += 1;
        }

        if (tryCount >= maxTryCount) {
          cleanTimer();
          reject(new Error(ERRORS.NOT_FOUND_DISK_PATH));
        }
      }, 1500);
    });

  const findDiskPath = (): Promise<string> =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise(async (resolve, reject) => {
      const platform = getPlatform();
      if (platform === 'mac') {
        try {
          const macDiskPath = await findMacDiskPath();
          resolve(macDiskPath);
        } catch (e) {
          reject(e);
        }
        return;
      }

      if (platform === 'win') {
        try {
          const winDiskPath = await findWindowsDiskPath();
          resolve(winDiskPath);
        } catch (e) {
          reject(e);
        }
        return;
      }

      return '';
    });

  // eslint-disable-next-line no-nested-ternary
  const resourcePath = isDev
    ? path.join(__dirname, '../public')
    : process.mas
    ? path.join(process.env.HOME ?? '', 'static')
    : path.join(process.resourcesPath, 'static');
  const ZipFilePath = path.join(resourcePath, 'res-updater.zip');
  const ExtractPath = path.join(resourcePath, 'res');
  const SourceFolder = path.join(resourcePath, 'res/res');

  const downloadFile = (fileUrl: string) => {
    logger.info('resource path: ', resourcePath);
    if (!fs.existsSync(resourcePath)) {
      logger.info('create resource path start');
      fs.mkdirSync(resourcePath, { recursive: true });
      logger.info('create resource path end');
    }
    const writer = fs.createWriteStream(ZipFilePath);
    return Axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    })
      .then((response) => {
        logger.info('download resource file success');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        response.data.pipe(writer);
        return finished(writer);
      })
      .catch((e) => {
        logger.info('download resource file error: ', e);
        throw new Error(ERRORS.DOWNLOAD_FAILED);
      });
  };

  const extractResFile = () => {
    logger.info('zipFilePath: ', ZipFilePath);
    logger.info('extractPath: ', ExtractPath);

    const zip = new AdmZip(ZipFilePath);
    zip.extractAllTo(ExtractPath, true);
  };

  const copyFile = async (sourceFile: string, targetFile: string) =>
    new Promise((resolve, reject) => {
      fs.copyFile(sourceFile, targetFile, (copyErr) => {
        if (copyErr) {
          logger.error('copyFile error: ', copyErr);
          reject(copyErr);
          return;
        }
        logger.log(`Copied ${sourceFile} to ${targetFile}`);
        resolve(true);
      });
    });

  const getDirSize = async (dir: string, files: string[]) => {
    const stats = files
      .filter((file) => file !== '.DS_Store')
      .map((file) => fsPromises.stat(path.join(dir, file)));
    return (await Promise.all(stats)).reduce(
      (accumulator, { size }) => accumulator + size,
      0,
    );
  };

  const writeResFile = (diskPath: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const targetFolder = path.join(diskPath, 'res');

      logger.info(
        'targetFolder exists: ',
        fs.existsSync(targetFolder),
        ' .   target: ',
        targetFolder,
      );
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
      }

      fs.readdir(SourceFolder, async (err, files) => {
        if (err) {
          logger.error('readdir error: ', err);
          reject(err);
          return;
        }

        const start = process.uptime();
        const totalSize = await getDirSize(SourceFolder, files);
        let chunkSize = 0;
        const end = process.uptime();
        logger.info(
          `get ${SourceFolder} folder size took this much time: ${
            end - start
          }, totlaSize: ${totalSize}`,
        );

        try {
          const copyFiles = files.filter((file) => file !== '.DS_Store');
          for (const file of copyFiles) {
            const sourceFile = path.join(SourceFolder, file);
            const targetFile = path.join(targetFolder, file);

            await copyFile(sourceFile, targetFile);

            const { size } = await fsPromises.stat(sourceFile);
            chunkSize += size;

            mainWindow.webContents.send(
              `touch/update-progress`,
              Math.ceil((chunkSize / totalSize) * 100),
            );
          }
        } catch (copyErr) {
          logger.error('copyFile error: ', copyErr);
          reject(copyErr);
        }

        resolve(true);
      });
    });

  ipcMain.on(
    ipcMessageKeys.TOUCH_RES,
    async (
      _,
      params: {
        resourceUrl: string;
        dialogTitle: string;
        buttonLabel: string;
      },
    ) => {
      logger.info('will update Touch resource file, params: ', params);
      try {
        if (process.mas) {
          const result = dialog.showOpenDialogSync(mainWindow, {
            buttonLabel: params.buttonLabel,
            defaultPath: MacVolumesPath,
            properties: ['openDirectory'],
            message: params.dialogTitle,
          });
          logger.info('open dialog permission : ====> ', result);
          if (
            !(result ?? []).find(
              (item) => item.indexOf('/Volumes/ONEKEY DATA') > -1,
            )
          ) {
            logger.error('mas permission denied');
            throw new Error(ERRORS.MAS_DISK_PATH_PERMISSION_DENIED);
          }
        }

        const diskPath = await findDiskPath();
        logger.info('disk path: ', diskPath);
        if (!diskPath) {
          throw new Error(ERRORS.NOT_FOUND_DISK_PATH);
        }

        await downloadFile(params.resourceUrl);
        extractResFile();

        const writeResult = await writeResFile(diskPath);
        logger.info('write result: ', writeResult);

        mainWindow.webContents.send(`touch/update-res-success`, {
          error: null,
          result: true,
        });
      } catch (e) {
        logger.error('Touch update resource error ====> ', e);
        mainWindow.webContents.send(`touch/update-res-success`, {
          error: e,
          result: false,
        });
      }
    },
  );

  ipcMain.on(ipcMessageKeys.TOUCH_OPEN_PRIVACY_PANEL, () => {
    void shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy',
    );
  });
};

export default init;
