import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTarget = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 2v6m10 4h-6m-4 4v6M8 12H2m10 7a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
    />
  </Svg>
);
export default SvgTarget;
