import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import AdmZip from 'adm-zip';
import { ipcMain } from 'electron';
import logger from 'electron-log';
import { WebUSB } from 'usb';

import type { BrowserWindow } from 'electron';

const ONEKEY_FILTER = [
  { vendorId: 0x483, productId: 0x5720 }, // mass storage touch
];

const ERRORS = {
  NOT_FOUND_DEVICE: 'NOT_FOUND_DEVICE',
  NOT_FOUND_DISK_PATH: 'NOT_FOUND_DISK_PATH',
  DISK_ACCESS_ERROR: 'DISK_ACCESS_ERROR',
};

const init = ({ mainWindow }: { mainWindow: BrowserWindow }) => {
  const webusb = new WebUSB({
    allowAllDevices: true,
  });

  const searchOneKeyTouch = async () => {
    const devices = await webusb.getDevices();
    const onekeyDevices = devices.filter((dev) => {
      const isOneKey = ONEKEY_FILTER.some(
        (desc) =>
          dev.vendorId === desc.vendorId && dev.productId === desc.productId,
      );
      return isOneKey;
    });

    return onekeyDevices;
  };

  const checkDeviceConnect = async () =>
    new Promise((resolve, reject) => {
      let intervalId: ReturnType<typeof setInterval> | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanTimer = () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
      intervalId = setInterval(async () => {
        const devices = await searchOneKeyTouch();
        if (devices.length) {
          cleanTimer();
          resolve(devices);
        }
      }, 1500);
      timeoutId = setTimeout(() => {
        cleanTimer();
        reject(new Error(ERRORS.NOT_FOUND_DEVICE));
      }, 1000 * 60 * 1);
    });

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

  const findMacDiskPath = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const MacDiskPath = '/Volumes/ONEKEY DATA';
      fs.access(
        MacDiskPath,
        // eslint-disable-next-line no-bitwise
        fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK,
        (err) => {
          if (err) {
            logger.debug('mac disk access error =====> ', err);
            reject(err);
            return;
          }
          resolve(MacDiskPath);
        },
      );
    });

  const findWindowsDiskPath = async (): Promise<string> =>
    new Promise((resolve, reject) => {
      const wmic = spawn('wmic', [
        'logicaldisk',
        'where',
        'drivetype=2',
        'get',
        'deviceid,volumename',
      ]);

      wmic.stdout.on('data', (buffer: Buffer) => {
        let data = buffer.toString('utf8');
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

        const diskPath = Object.keys(result).find(
          (key) => result[key].indexOf('ONEKEYDATA') > -1,
        );
        if (diskPath) {
          fs.access(
            `${diskPath}:`,
            // eslint-disable-next-line no-bitwise
            fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK,
            (err) => {
              if (err) {
                logger.error('windows disk access error =====> ', err);
                reject(new Error(ERRORS.DISK_ACCESS_ERROR));
                return;
              }
              resolve(`${diskPath}:`);
            },
          );
        } else {
          reject(new Error(ERRORS.NOT_FOUND_DISK_PATH));
        }
      });

      wmic.stderr.on('data', (data: string) => {
        logger.error(`wmin command failure, error ===> : ${data}`);
        reject(new Error(ERRORS.NOT_FOUND_DISK_PATH));
      });

      wmic.on('close', (code: string) => {
        logger.debug(`wmic command child process exited with code ${code}`);
      });
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

  const extractResFile = () => {
    const zipFilePath = path.join(__dirname, '../public/res-updater.zip');
    const extractPath = path.join(__dirname, '../public/res');

    console.log('zipFilePath: ', zipFilePath);
    console.log('extractPath: ', extractPath);

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(extractPath, true);
  };

  const writeResFile = (diskPath: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const sourceFolder = path.join(
        __dirname,
        '../public/res/res-20221031-updater',
      );
      const targetFolder = path.join(diskPath, 'copy-res');

      fs.readdir(sourceFolder, (err, files) => {
        if (err) {
          logger.error('readdir error: ', err);
          reject(err);
          return;
        }

        files.forEach((file) => {
          const sourceFile = path.join(sourceFolder, file);
          const targetFile = path.join(targetFolder, file);

          fs.copyFile(sourceFile, targetFile, (copyErr) => {
            if (copyErr) {
              logger.error('copyFile error: ', copyErr);
              reject(copyErr);
            }
          });
          logger.log(`Copied ${sourceFile} to ${targetFile}`);
        });

        resolve(true);
      });
    });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ipcMain.on('touch/res', async (_, params: any) => {
    logger.info('will update Touch resource file');
    try {
      const checkDevice = await checkDeviceConnect();
      logger.info('connect device: ', checkDevice);

      const diskPath = await findDiskPath();
      logger.info('disk path: ', diskPath);
      if (!diskPath) {
        throw new Error(ERRORS.NOT_FOUND_DISK_PATH);
      }

      extractResFile();

      const writeResult = await writeResFile(diskPath);
      console.log('write result: ', writeResult);

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
  });
};

export default init;
