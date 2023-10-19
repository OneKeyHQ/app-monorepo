import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMic = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19v2m0-2c-3.678 0-5.853-2.255-6.986-4M12 19c3.678 0 5.853-2.255 6.985-4M16 7v4a4 4 0 1 1-8 0V7a4 4 0 1 1 8 0Z"
    />
  </Svg>
);
export default SvgMic;
