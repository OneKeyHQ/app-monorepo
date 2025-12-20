import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.667 4.455a1 1 0 1 0 .666-1.886zm7.085 5.324a1 1 0 1 0-1.95.442zM19 1a1 1 0 1 0 0 2zm3 1 .8.6A1 1 0 0 0 22 1zm-3 4-.8-.6A1 1 0 0 0 19 7zm3 1a1 1 0 1 0 0-2zm-9 1a1 1 0 1 0-2 0zm-1 4h-1a1 1 0 0 0 .293.707zm1.793 3.207a1 1 0 0 0 1.414-1.414zM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12zm8-8c.937 0 1.834.16 2.667.455l.666-1.886A10 10 0 0 0 12 2zm7.802 6.221A8 8 0 0 1 20 12h2c0-.762-.085-1.506-.248-2.221zM19 3h3V1h-3zm2.2-1.6-3 4 1.6 1.2 3-4zM19 7h3V5h-3zm-8 1v4h2V8zm.293 4.707 2.5 2.5 1.414-1.414-2.5-2.5z"
    />
  </Svg>
);
export default SvgClockSnooze;
