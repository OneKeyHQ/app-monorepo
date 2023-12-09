import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19 1a1 1 0 1 0 0 2h1l-1.8 2.4A1 1 0 0 0 19 7h3a1 1 0 1 0 0-2h-1l1.8-2.4A1 1 0 0 0 22 1h-3Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16 3.487a.941.941 0 0 0-.608-.897A9.984 9.984 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10c0-.788-.091-1.555-.264-2.292-.1-.425-.491-.708-.928-.708H18a2 2 0 0 1-2-2V3.487ZM12 7a1 1 0 0 1 1 1v3.586l2.207 2.207a1 1 0 0 1-1.414 1.414l-2.5-2.5A1 1 0 0 1 11 12V8a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClockSnooze;
