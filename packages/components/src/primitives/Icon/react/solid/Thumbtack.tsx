import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbtack = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.5 2a3 3 0 0 0-3 3v2.229a5.69 5.69 0 0 1-1.667 4.023A2.845 2.845 0 0 0 4 13.264V15a1 1 0 0 0 1 1h6v5a1 1 0 1 0 2 0v-5h6a1 1 0 0 0 1-1v-1.736c0-.754-.3-1.478-.833-2.012A5.69 5.69 0 0 1 17.5 7.23V5a3 3 0 0 0-3-3h-5Z"
    />
  </Svg>
);
export default SvgThumbtack;
