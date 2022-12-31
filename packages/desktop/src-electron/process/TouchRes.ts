import fs from 'fs';
import path from 'path';

import AdmZip from 'adm-zip';
import logger from 'electron-log';
import { WebUSB } from 'usb';

/**
 * 1、webusb 轮询搜索 usb 设备，找到 Mass Storage 状态的 OneKey 设备
 * 2、区分系统，确定写入路径，写入路径的寻找过程需要考虑 ONEKEY DATA 名称被篡改的情况，可以通过读取文件夹的路径来判断 res && !res.metadata 来判断
 * 3、遍历 res 目录下的文件，写入 U 盘
 */

const ONEKEY_FILTER = [
  { vendorId: 0x483, productId: 0x5720 }, // mass storage touch
];

const init = () => {
  const webusb = new WebUSB({
    allowAllDevices: true,
  });
  // 1、webusb 轮询搜索 usb 设备，找到 Mass Storage 状态的 OneKey 设备
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
        reject(new Error('Not Found'));
      }, 1000 * 60 * 5);
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

  const findDiskPath = () =>
    new Promise((resolve, reject) => {
      const platform = getPlatform();
      if (platform === 'mac') {
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
      }

      if (platform === 'win') {
        // TODO: Windows 搜索盘符逻辑
      }
    });

  const extractResFile = () => {
    const zipFilePath = path.join(__dirname, '../public/res-updater.zip');
    const extractPath = path.join(__dirname, '../public/res');

    console.log('zipFilePath: ', zipFilePath);
    console.log('extractPath: ', extractPath);

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(extractPath, true);
  };

  const writeResFile = () =>
    new Promise((resolve, reject) => {
      const sourceFolder = path.join(
        __dirname,
        '../public/res/res-20221031-updater',
      );
      const targetFolder = path.join(__dirname, '../public/copy-res');

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

  const test = async () => {
    const result = await checkDeviceConnect();
    console.log('connect result: ', result);

    const diskPath = await findDiskPath();
    console.log('disk path: ', diskPath);

    extractResFile();

    const writeResult = await writeResFile();
    console.log('write result: ', writeResult);
  };

  test();
};

export default init;
