import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMicOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 21v-2m0 0c-3.678 0-5.853-2.255-6.986-4M12 19c2.228 0 3.905-.828 5.132-1.868M9.52 3.862A4 4 0 0 1 16 7v3.343M3 3l5 5m0 0v3a4 4 0 0 0 6.284 3.284M8 8l6.284 6.284m0 0 2.848 2.848m0 0L21 21"
    />
  </Svg>
);
export default SvgMicOff;
