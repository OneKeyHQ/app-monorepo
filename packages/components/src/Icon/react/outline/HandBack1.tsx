import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandBack1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 8V7a2 2 0 1 1 4 0v6.83m0 0V11m0 2.83a7.17 7.17 0 0 1-13.516 3.339L3.5 11.5l.75-.938a2 2 0 0 1 2.812-.313L8 11V6a2 2 0 1 1 4 0v4m0-2V5a2 2 0 1 1 4 0v6"
    />
  </Svg>
);
export default SvgHandBack1;
