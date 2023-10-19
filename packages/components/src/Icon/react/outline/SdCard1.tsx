import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSdCard1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 7v2m4-2v2M7 3h8a2 2 0 0 1 2 2v2.092a3 3 0 0 0 .504 1.664l.992 1.488A3 3 0 0 1 19 11.908V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgSdCard1;
