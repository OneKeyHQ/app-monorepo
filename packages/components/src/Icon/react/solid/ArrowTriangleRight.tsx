import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8.336 4.319C6.344 3.323 4 4.77 4 6.998v10.004c0 2.227 2.344 3.674 4.336 2.68l10.008-5.003c2.208-1.104 2.208-4.255 0-5.358L8.336 4.319Z"
    />
  </Svg>
);
export default SvgArrowTriangleRight;
