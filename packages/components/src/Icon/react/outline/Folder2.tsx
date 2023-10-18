import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolder2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 13v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1M5 4h4.172a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 12.828 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgFolder2;
