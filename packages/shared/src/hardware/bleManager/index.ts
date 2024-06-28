type IBleManager = {
  checkState(): Promise<'on' | 'off'>;
};
class BleManagerInstance {
  async getBleManager(): Promise<IBleManager | undefined> {
    return undefined;
  }

  /**
   * get bonded devices (only android)
   * @returns Bound device
   */
  async getBondedDevices() {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkDeviceBonded(connectId: string) {
    return Promise.resolve(false);
  }
}

export default new BleManagerInstance();
