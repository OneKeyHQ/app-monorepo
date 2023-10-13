import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.667 4.455a1 1 0 1 0 .666-1.886l-.666 1.886Zm7.085 5.324a1 1 0 1 0-1.95.442l1.95-.442ZM19 1a1 1 0 1 0 0 2V1Zm3 1 .8.6A1 1 0 0 0 22 1v1Zm-3 4-.8-.6A1 1 0 0 0 19 7V6Zm3 1a1 1 0 1 0 0-2v2Zm-9 1a1 1 0 1 0-2 0h2Zm-1 4h-1a1 1 0 0 0 .293.707L12 12Zm1.793 3.207a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10h-2Zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10v-2Zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12h2Zm8-8c.937 0 1.834.16 2.667.455l.666-1.886A9.985 9.985 0 0 0 12 2v2Zm7.802 6.221A8.03 8.03 0 0 1 20 12h2c0-.762-.085-1.506-.248-2.221l-1.95.442ZM19 3h3V1h-3v2Zm2.2-1.6-3 4 1.6 1.2 3-4-1.6-1.2ZM19 7h3V5h-3v2Zm-8 1v4h2V8h-2Zm.293 4.707 2.5 2.5 1.414-1.414-2.5-2.5-1.414 1.414Z"
    />
  </Svg>
);
export default SvgClockSnooze;
