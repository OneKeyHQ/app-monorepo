class BleManagerInstance {
  checkState(): Promise<'on' | 'off'> {
    return Promise.resolve('on');
  }

  getConnectedPeripheralsDebug(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

export default new BleManagerInstance();
