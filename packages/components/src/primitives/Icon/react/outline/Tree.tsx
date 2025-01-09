import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTree = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 21v-6m0 0-2-2m2 2 3-3m5-1a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
    />
  </Svg>
);
export default SvgTree;
