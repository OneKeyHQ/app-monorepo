import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRedo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m17.5 5 3.293 3.293a1 1 0 0 1 0 1.414L17.5 13M20 9H7a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h5"
    />
  </Svg>
);
export default SvgRedo;
