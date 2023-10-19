import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 6h13a2 2 0 0 1 2 2v13M6 3v13a2 2 0 0 0 2 2h13"
    />
  </Svg>
);
export default SvgCrop;
