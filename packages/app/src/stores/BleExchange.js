import { action, makeObservable, observable } from 'mobx';
import { Buffer } from 'buffer';

class BleExchange {
  debug = true;

  requestNeeded = false;

  activitySession = undefined;

  isReadDone = false;

  buffer = [];

  headbuffer = [];

  maxSize = 0;

  constructor() {
    makeObservable(this, {
      isReadDone: observable,
      buffer: observable,
      activitySession: observable,
      acquire: action.bound,
      addBuffer: action,
      release: action.bound,
    });
  }

  acquire() {
    this.cleardata();
    this.requestNeeded = true;
    this.activitySession = this.createSession();
  }

  addBuffer(input) {
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
      this.isReadDone = true;
    }
  }

  cleardata() {
    this.requestNeeded = false;
    this.isReadDone = false;
    this.buffer = [];
    this.headbuffer = [];
  }

  release() {
    this.cleardata();
    this.activitySession = undefined;
  }

  getData() {
    return Buffer.from(this.headbuffer.concat(this.buffer));
  }

  createSession = () => {
    let guid = '';
    for (let i = 1; i <= 32; i += 1) {
      const n = Math.floor(Math.random() * 16.0).toString(16);
      guid += n;
      if (i === 8 || i === 12 || i === 16 || i === 20) guid += '-';
    }
    return guid;
  };
}

export default BleExchange;
