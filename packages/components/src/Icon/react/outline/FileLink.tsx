import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M5 8V5a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l4.828 4.828A2 2 0 0 1 19 9.828V19a2 2 0 0 1-2 2h-4.5M13 3.5V7a2 2 0 0 0 2 2h3.5M3 15a3 3 0 1 1 6 0m-6 3a3 3 0 1 0 6 0m-3-2v1"
    />
  </Svg>
);
export default SvgFileLink;
