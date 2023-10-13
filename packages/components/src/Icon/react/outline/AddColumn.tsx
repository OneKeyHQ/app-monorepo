import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 19v1a1 1 0 0 0 1-1h-1Zm8-9a1 1 0 1 0 2 0h-2Zm0 4a1 1 0 1 0-2 0h2Zm-2 6a1 1 0 1 0 2 0h-2Zm-2-4a1 1 0 1 0 0 2v-2Zm6 2a1 1 0 1 0 0-2v2ZM4 17V7H2v10h2Zm8 1H5v2h7v-2Zm8-11v3h2V7h-2ZM5 6h7V4H5v2Zm7 0h7V4h-7v2Zm1 13V5h-2v14h2Zm5-5v3h2v-3h-2Zm0 3v3h2v-3h-2Zm-2 1h3v-2h-3v2Zm3 0h3v-2h-3v2Zm3-11a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1h2ZM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3h2ZM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1H2Z"
    />
  </Svg>
);
export default SvgAddColumn;
