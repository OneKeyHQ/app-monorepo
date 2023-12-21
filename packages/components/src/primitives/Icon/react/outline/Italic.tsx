import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgItalic = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 4h4.5M19 4h-4.5m0 0-5 16m0 0H5m4.5 0H14"
    />
  </Svg>
);
export default SvgItalic;
