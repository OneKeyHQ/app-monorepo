import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColumnWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 17V7H2v10h2Zm8 1H5v2h7v-2Zm8-11v10h2V7h-2ZM5 6h7V4H5v2Zm7 0h7V4h-7v2Zm1 13V5h-2v14h2Zm6-1h-7v2h7v-2Zm1-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2Zm2-10a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1h2ZM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3h2ZM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1H2Z"
    />
  </Svg>
);
export default SvgColumnWide;
