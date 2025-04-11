import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOnekey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      d="M23 12c0 7.594-3.406 11-11 11-7.594 0-11-3.406-11-11C1 4.406 4.406 1 12 1c7.594 0 11 3.406 11 11Z"
      fill="#44D62C"
    />
    <Path
      d="M12.994 5.665h-3.06l-.537 1.623h1.7v3.42h1.897V5.664Z"
      fill="#000"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.49 14.846a3.49 3.49 0 1 1-6.98 0 3.49 3.49 0 0 1 6.98 0Zm-1.584 0a1.906 1.906 0 1 1-3.811 0 1.906 1.906 0 0 1 3.81 0Z"
      fill="#000"
    />
  </Svg>
);
export default SvgOnekey;
