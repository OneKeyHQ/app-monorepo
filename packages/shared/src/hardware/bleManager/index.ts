class BleManagerInstance {
  checkState(): Promise<'on' | 'off'> {
    return Promise.resolve('on');
  }
}

export default new BleManagerInstance();
