import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShredder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 13h18M5 9V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M6 17v2m4-2v4m4-4v2m4-2v4"
    />
  </Svg>
);
export default SvgShredder;
