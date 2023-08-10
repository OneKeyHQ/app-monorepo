import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlus = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </Svg>
);
export default SvgPlus;
