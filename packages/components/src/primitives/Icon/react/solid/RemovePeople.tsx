import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemovePeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM3.696 18.696C4.553 14.884 7.7 12 12 12c1.425 0 2.723.317 3.853.879A3 3 0 0 0 13.01 21H5.6c-1.136 0-2.193-1.014-1.903-2.304Zm13.011-3.403a1 1 0 0 0-1.414 1.414L16.586 18l-1.293 1.293a1 1 0 0 0 1.414 1.414L18 19.414l1.293 1.293a1 1 0 0 0 1.414-1.414L19.414 18l1.293-1.293a1 1 0 0 0-1.414-1.414L18 16.586l-1.293-1.293Z"
    />
  </Svg>
);
export default SvgRemovePeople;
