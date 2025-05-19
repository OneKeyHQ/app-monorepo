function hardwareLog(name: string, ...args: any[]) {
  return;
  console.log(`ServiceHardwareLog@${name}`, ...args);
}

export default {
  hardwareLog,
};
