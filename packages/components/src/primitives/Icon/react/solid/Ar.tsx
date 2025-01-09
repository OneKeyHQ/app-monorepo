import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h3.249a3 3 0 0 0 1.975-.742L12 16.828l2.776 2.43a3 3 0 0 0 1.976.742H20a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H4Zm3.5 4.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm6.75 2.25a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAr;
