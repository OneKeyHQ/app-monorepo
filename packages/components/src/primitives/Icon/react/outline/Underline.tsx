import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUnderline = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M6 21h12M6 4v8a6 6 0 0 0 12 0V4"
    />
  </Svg>
);
export default SvgUnderline;
