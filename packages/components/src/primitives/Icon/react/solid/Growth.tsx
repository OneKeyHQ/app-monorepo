import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGrowth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 3a1 1 0 0 0-1 1v1a8 8 0 0 0 8 8v7a1 1 0 1 0 2 0v-4a8 8 0 0 0 8-8V7a1 1 0 0 0-1-1h-1a7.985 7.985 0 0 0-6.25 3.006A8.003 8.003 0 0 0 5 3H4Z"
    />
  </Svg>
);
export default SvgGrowth;
