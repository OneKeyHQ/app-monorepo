import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextIndicator = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 6h5m0 0h5M8 6v12m9-15h2m0 0h2m-2 0v18m0 0h-2m2 0h2"
    />
  </Svg>
);
export default SvgTextIndicator;
