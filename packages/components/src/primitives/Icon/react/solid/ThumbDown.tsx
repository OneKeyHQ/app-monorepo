import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.197 20.895A1.99 1.99 0 0 1 12.415 22a2.998 2.998 0 0 1-2.958-3.462L9.852 16H5.99c-2.421 0-4.279-2.142-3.953-4.54l.68-5A3.993 3.993 0 0 1 6.668 3H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2.38l-3.423 6.895ZM18 12h2V5h-2v7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbDown;
