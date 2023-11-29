import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryEmpty = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 8a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm19 6h1v-4h-1v4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryEmpty;
