import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCode = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m10 9.5-1.793 1.793a1 1 0 0 0 0 1.414L10 14.5m4-5 1.793 1.793a1 1 0 0 1 0 1.414L14 14.5M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgCode;
