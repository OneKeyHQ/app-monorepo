import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerLeftDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 4h-8a4 4 0 0 0-4 4v11.75m4-3.25-3.293 3.293a1 1 0 0 1-1.414 0L4 16.5"
    />
  </Svg>
);
export default SvgCornerLeftDown;
