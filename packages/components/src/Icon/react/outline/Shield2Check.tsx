import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShield2Check = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 12 2 2 4-4m-3.802-7.15-6 2.626A2 2 0 0 0 4 7.308V13a8 8 0 1 0 16 0V7.308a2 2 0 0 0-1.198-1.832l-6-2.625a2 2 0 0 0-1.604 0Z"
    />
  </Svg>
);
export default SvgShield2Check;
