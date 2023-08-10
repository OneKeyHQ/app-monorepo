import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUsbCable = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      d="M10.5 6v1.5m3-1.5v1.5m3 3h-9V3.75A.75.75 0 0 1 8.25 3h7.5a.75.75 0 0 1 .75.75v6.75ZM14.25 21h-4.5a4.5 4.5 0 0 1-4.5-4.5V12a1.5 1.5 0 0 1 1.5-1.5h10.5a1.5 1.5 0 0 1 1.5 1.5v4.5a4.5 4.5 0 0 1-4.5 4.5Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgUsbCable;
