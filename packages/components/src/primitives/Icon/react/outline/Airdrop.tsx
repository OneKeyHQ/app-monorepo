import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAirdrop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 18" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M.5 8.164a7.5 7.5 0 0 1 15-.01.83.83 0 0 1-.318.668l-4.66 3.661a2.5 2.5 0 0 1-.855 4.85H6.333a2.5 2.5 0 0 1-.855-4.85L.824 8.826l-.049-.04-.003-.003A.83.83 0 0 1 .5 8.166zm3 .645 3.667 2.881V8.595A71 71 0 0 0 3.5 8.81m5.333-.214v3.095L12.5 8.81l-.253-.02a71 71 0 0 0-3.414-.194m-5.21-1.468c-.524.041-.999.082-1.384.116a5.835 5.835 0 0 1 11.522 0c-.385-.034-.86-.075-1.385-.116-1.344-.104-3.038-.21-4.376-.21s-3.032.106-4.376.21M5.5 14.833c0-.46.373-.833.833-.833h3.334a.833.833 0 0 1 0 1.666H6.333a.833.833 0 0 1-.833-.833"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAirdrop;
