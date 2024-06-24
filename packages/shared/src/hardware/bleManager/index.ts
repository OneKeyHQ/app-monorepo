type IBleManager = {
  checkState(): Promise<void>;
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

  async checkDeviceBonded(connectId: string) {
    return Promise.resolve(false);
  }
}

export default new BleManagerInstance();
