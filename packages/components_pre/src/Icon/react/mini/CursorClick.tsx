import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorClick = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.672 1.911a1 1 0 1 0-1.932.518l.259.966a1 1 0 0 0 1.932-.518l-.26-.966zM2.429 4.74a1 1 0 1 0-.517 1.932l.966.259a1 1 0 0 0 .517-1.932l-.966-.26zm8.814-.569a1 1 0 0 0-1.415-1.414l-.707.707a1 1 0 1 0 1.415 1.415l.707-.708zm-7.071 7.072.707-.707A1 1 0 0 0 3.465 9.12l-.708.707a1 1 0 0 0 1.415 1.415zm3.2-5.171a1 1 0 0 0-1.3 1.3l4 10a1 1 0 0 0 1.823.075l1.38-2.759 3.018 3.02a1 1 0 0 0 1.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 0 0-.076-1.822l-10-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCursorClick;
