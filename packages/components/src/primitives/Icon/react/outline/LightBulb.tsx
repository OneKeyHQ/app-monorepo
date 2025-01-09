import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 21h4m1.608-6a7 7 0 1 0-7.215 0m7.215 0c-.197.118-.4.227-.608.326V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.674A6.976 6.976 0 0 1 8.392 15m7.216 0H8.392"
    />
  </Svg>
);
export default SvgLightBulb;
