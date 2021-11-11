/* eslint-disable */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Buffer } from 'buffer';

type Listener = (state: BleExchange) => boolean;

class BleExchange {
  debug = true;

  requestNeeded = false;

  activitySession?: string = undefined;

  isReadDone = false;

  buffer: any;

  headbuffer: any;

  maxSize = 0;

  acquire(): void {
    this.clearData();
    this.requestNeeded = true;
    this.activitySession = this.createSession();
  }

  addBuffer(input: Buffer): void {
    // TODO: 从蓝牙接收到的数据可能会超过MTU，这时蓝牙外设会返回两次或两次以上的通知，我们必须接收到完整的数据才能返回给调用方。
    // 关于如何判断是否收到完整的数据包：1. 首包的格式为：9字节header(?## + 2字节的类型 + 4字节的总负载长度) + payload 2.
    // 从首包数据中获取总负载长度(总负载长度不包括header的长度)
    // 另外我们需要对接收到的数据做下处理：删除首包开头的 "?"，返回剩余数据。
    const data = Buffer.from(input);
    if (
      data.length > 9 &&
      data[0] === '?'.charCodeAt(0) &&
      data[1] === '#'.charCodeAt(0) &&
      data[2] === '#'.charCodeAt(0)
    ) {
      this.headbuffer = [...data.subarray(1, 9)];
      this.maxSize = data.readIntBE(5, 4);
      this.buffer = [...data.subarray(9)];
      if (this.debug) {
        console.log('BleExchange', '处理首包数据', '数据长度', this.maxSize);
      }
    } else {
      if (this.debug) {
        console.log('BleExchange', '处理次包数据', '数据长度', data.length);
      }
      this.buffer = this.buffer.concat([...data]);
    }
    if (this.debug) {
      console.log('BleExchange', '当前数据包大小', this.buffer.length);
    }
    if (this.buffer.length >= this.maxSize) {
      if (this.debug) {
        console.log(
          'BleExchange',
          '数据收集完毕',
          '数据长度',
          this.buffer.length,
        );
      }
      console.log('----this prev', this.isReadDone);
      this.isReadDone = true;
      console.log('----this', this.isReadDone);
    }
  }

  clearData(): void {
    this.requestNeeded = false;
    this.isReadDone = false;
    this.buffer = [];
    this.headbuffer = [];
  }

  release(): void {
    this.clearData();
    this.activitySession = undefined;
  }

  getData(): Buffer {
    return Buffer.from(this.headbuffer.concat(this.buffer));
  }

  createSession = (): string => {
    let guid = '';
    for (let i = 1; i <= 32; i += 1) {
      const n = Math.floor(Math.random() * 16.0).toString(16);
      guid += n;
      if (i === 8 || i === 12 || i === 16 || i === 20) guid += '-';
    }
    return guid;
  };

  async waitUtil(listener: Listener, timeout = 0.5) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        const status = listener(this);
        console.log('---status', status);
        // if (status) {
        //   clearInterval(id);
        //   console.log('--resolve', this.isReadDone);
        return resolve(this);
        // }
      }, timeout * 1000);
    });
  }
}

export default new BleExchange();
