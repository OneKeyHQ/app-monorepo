import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgYen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.253 7.341a1 1 0 1 0-1.506 1.317l1.506-1.316Zm7 1.317a1 1 0 0 0-1.506-1.316l1.506 1.317ZM11 17a1 1 0 1 0 2 0h-2Zm-1-5a1 1 0 1 0 0 2v-2Zm4 2a1 1 0 1 0 0-2v2ZM7.747 8.659l3.5 4 1.506-1.318-3.5-4-1.506 1.317Zm5.006 4 3.5-4-1.506-1.318-3.5 4 1.506 1.318ZM11 12v1h2v-1h-2Zm0 1v4h2v-4h-2Zm-1 1h2v-2h-2v2Zm2 0h2v-2h-2v2Zm8-2a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10h-2Zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10v-2Zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12h2Zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10v2Z"
    />
  </Svg>
);
export default SvgYen;
