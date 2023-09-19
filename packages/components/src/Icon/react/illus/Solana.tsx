import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgSolana = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M10.681 5.871a.32.32 0 0 1-.128.027h-6.62a.16.16 0 0 1-.15-.098.167.167 0 0 1 .03-.178l1.395-1.517A.323.323 0 0 1 5.445 4h6.62a.16.16 0 0 1 .151.098.165.165 0 0 1-.03.178l-1.397 1.518a.323.323 0 0 1-.107.077Zm.108 1.118a.326.326 0 0 0-.236-.105h-6.62a.16.16 0 0 0-.15.099.166.166 0 0 0 .03.177l1.395 1.518a.326.326 0 0 0 .237.105h6.62a.16.16 0 0 0 .148-.1.166.166 0 0 0-.03-.176L10.79 6.989Zm1.396 3.056-1.396 1.517a.323.323 0 0 1-.236.105h-6.62a.16.16 0 0 1-.15-.099.166.166 0 0 1 .03-.178l1.395-1.517a.323.323 0 0 1 .237-.105h6.62a.16.16 0 0 1 .151.098.165.165 0 0 1-.03.179Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSolana;
