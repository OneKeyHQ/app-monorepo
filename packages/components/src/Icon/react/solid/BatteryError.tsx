import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryError = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a3 3 0 0 0-3-3H4Zm16 5v4h1v-4h-1ZM7.793 9.293a1 1 0 0 1 1.414 0l1.293 1.293 1.293-1.293a1 1 0 1 1 1.414 1.414L11.914 12l1.293 1.293a1 1 0 0 1-1.414 1.414L10.5 13.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L9.086 12l-1.293-1.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryError;
