import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavSend = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.435 3.582a1.933 1.933 0 0 0-1.93-.503L2.408 7.759a1.92 1.92 0 0 0-1.384 1.522c-.142.75.355 1.704 1.003 2.102l5.033 3.094a1.304 1.304 0 0 0 1.61-.194l5.763-5.799a.734.734 0 0 1 1.06 0c.29.292.29.765 0 1.067l-5.773 5.8c-.428.43-.508 1.1-.193 1.62l3.075 5.083c.36.604.98.946 1.66.946.08 0 .17 0 .251-.01.78-.1 1.4-.634 1.63-1.39l4.773-16.075c.21-.685.02-1.43-.48-1.943Z" />
  </Svg>
);
export default SvgNavSend;
