import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="m15.24 8.76-1.62 4.86-4.86 1.62 1.62-4.86 4.86-1.62Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgCompass;
