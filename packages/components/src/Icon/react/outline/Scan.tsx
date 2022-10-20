import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgScan = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 9h4V7h-4v2Zm5 1v4h2v-4h-2Zm-1 5h-4v2h4v-2Zm-5-1v-4H7v4h2Zm1 1a1 1 0 0 1-1-1H7a3 3 0 0 0 3 3v-2Zm5-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2Zm-1-5a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2Zm-4-2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V7ZM5 9V6H3v3h2Zm0 9v-3H3v3h2Zm14-3v3h2v-3h-2Zm0-9v3h2V6h-2ZM6 5h3V3H6v2Zm9 0h3V3h-3v2ZM9 19H6v2h3v-2Zm9 0h-3v2h3v-2ZM3 18a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1H3Zm16 0a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2Zm2-12a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1h2ZM5 6a1 1 0 0 1 1-1V3a3 3 0 0 0-3 3h2Z" />
  </Svg>
);
export default SvgScan;
