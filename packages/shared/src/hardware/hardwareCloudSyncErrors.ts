import { OneKeyLocalError } from '../errors';

const prerequisiteMessages = {
  logging: 'Disable hardware debug logging before unlocking the Cloud key',
  transport:
    'Hardware Cloud keys require direct USB or Bluetooth in this development build',
  compatibility:
    'Hardware Cloud keys require local hardware compatibility validation',
} as const;

export class HardwareCloudKeyPrerequisiteError extends OneKeyLocalError {
  constructor(readonly reason: keyof typeof prerequisiteMessages) {
    super(prerequisiteMessages[reason]);
  }
}
