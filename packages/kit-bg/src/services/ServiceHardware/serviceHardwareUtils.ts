function hardwareLog(name: string, ...args: any[]) {
  console.log(`ServiceHardwareLog@${name}`, ...args);
}

export default {
  hardwareLog,
};
