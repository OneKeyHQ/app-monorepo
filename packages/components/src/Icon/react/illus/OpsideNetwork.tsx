import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgOpsideNetwork = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="m5.341 6.253-1.095-.794a5.435 5.435 0 0 0-.422.866l1.283.416c.067-.168.145-.331.234-.488Zm1.053-1.216-.988-.933a5.471 5.471 0 0 0-.82.857l1.091.791a4.08 4.08 0 0 1 .717-.715Zm-1.47 2.281-1.282-.415c-.08.31-.132.627-.156.947h1.351c.018-.179.047-.357.088-.532Zm.127 2.296-1.282.415c.11.311.246.611.41.897l1.1-.796a4.074 4.074 0 0 1-.228-.52v.004Zm.546 1.03-1.09.788c.253.347.547.663.874.94l.986-.93a4.11 4.11 0 0 1-.77-.802v.004Zm-.77-2.09H3.485c.015.301.056.601.122.896l1.29-.417a4.346 4.346 0 0 1-.068-.483v.003ZM8.873 5.638a2.612 2.612 0 0 0-2.58 2.21h1.324a1.32 1.32 0 1 1-.026.703H6.284a2.61 2.61 0 1 0 2.59-2.913Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOpsideNetwork;
