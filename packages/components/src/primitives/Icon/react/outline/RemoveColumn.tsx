import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 19v1a1 1 0 0 0 1-1h-1Zm8-9a1 1 0 1 0 2 0h-2Zm-2.293 4.293a1 1 0 0 0-1.414 1.414l1.414-1.414Zm2.586 5.414a1 1 0 0 0 1.414-1.414l-1.414 1.414Zm-4-1.414a1 1 0 0 0 1.414 1.414l-1.414-1.414Zm5.414-2.586a1 1 0 0 0-1.414-1.414l1.414 1.414ZM4 17V7H2v10h2Zm8 1H5v2h7v-2Zm8-11v3h2V7h-2ZM5 6h7V4H5v2Zm7 0h7V4h-7v2Zm1 13V5h-2v14h2Zm3.293-3.293 2 2 1.414-1.414-2-2-1.414 1.414Zm2 2 2 2 1.414-1.414-2-2-1.414 1.414Zm-.586 2 2-2-1.414-1.414-2 2 1.414 1.414Zm2-2 2-2-1.414-1.414-2 2 1.414 1.414ZM22 7a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1h2ZM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3h2ZM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1H2Z"
    />
  </Svg>
);
export default SvgRemoveColumn;
