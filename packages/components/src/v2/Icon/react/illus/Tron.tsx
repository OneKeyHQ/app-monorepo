import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTron = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M12.965 5.604c-.37-.36-.762-.74-1.108-1.047l-.035-.024a.669.669 0 0 0-.194-.109l-.267-.05c-1.84-.343-7.804-1.456-7.926-1.44a.245.245 0 0 0-.102.038l-.033.026a.39.39 0 0 0-.091.147l-.009.023v.144c.405 1.127 1.457 3.645 2.428 5.97.821 1.965 1.585 3.793 1.85 4.526h.001c.035.109.102.315.226.325h.028c.066 0 .35-.374.35-.374s5.068-6.146 5.58-6.8c.067-.081.125-.168.175-.26a.422.422 0 0 0-.138-.392 42.675 42.675 0 0 1-.735-.703Zm-3.582 1.42 2.163-1.795 1.269 1.17-3.432.624Zm-4.564-3.17 3.724 3.052 2.301-1.94-6.025-1.112Zm4.06 3.852 3.811-.615-4.357 5.25.546-4.635Zm-.648-.223L4.313 4.158l3.351 8.187.567-4.862Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTron;
