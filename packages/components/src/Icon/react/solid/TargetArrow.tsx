import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTargetArrow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M18.577 2.568a1.25 1.25 0 0 0-2.07-.488l-2.628 2.628A3 3 0 0 0 13 6.829v2.757l-1.707 1.707a1 1 0 0 0 1.414 1.415L14.414 11h2.758a3 3 0 0 0 2.12-.879l2.63-2.628a1.25 1.25 0 0 0-.49-2.07l-2.141-.714-.714-2.142Z"
    />
    <Path
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8 1 1 0 1 0 0-2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10a1 1 0 1 0-2 0 8 8 0 1 1-16 0Z"
    />
    <Path
      fill="currentColor"
      d="M10.8 8.183a1 1 0 1 0-.6-1.908A6.002 6.002 0 0 0 12 18a6.002 6.002 0 0 0 5.725-4.2 1 1 0 1 0-1.908-.6A4.002 4.002 0 0 1 8 12a4.002 4.002 0 0 1 2.8-3.817Z"
    />
  </Svg>
);
export default SvgTargetArrow;
