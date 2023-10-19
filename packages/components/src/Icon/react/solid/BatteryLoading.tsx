import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 5h7.5l-4.8 6.4a1 1 0 0 0 .8 1.6h4L7 19H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17 19H9.5l4.8-6.4a1 1 0 0 0-.8-1.6h-4L14 5h3a3 3 0 0 1 3 3h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1a3 3 0 0 1-3 3Zm3-5h1v-4h-1v4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryLoading;
