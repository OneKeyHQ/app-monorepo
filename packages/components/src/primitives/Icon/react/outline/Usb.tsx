import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUsb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6v1m4-1v1M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Zm2-7h12v7H6V3Z"
    />
  </Svg>
);
export default SvgUsb;
