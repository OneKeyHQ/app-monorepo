import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 2a3 3 0 0 0-3 3v11.5a5.5 5.5 0 0 0 8.332 4.716l9.877-5.703a3 3 0 0 0 1.098-4.098l-2.5-4.33a2.992 2.992 0 0 0-.91-.98 2.991 2.991 0 0 0-.981-.912l-4.33-2.5a2.992 2.992 0 0 0-1.28-.395A2.992 2.992 0 0 0 10 2H5Zm14.21 11.781-5.683 3.28 4.366-7.56 1.682 2.914a1 1 0 0 1-.366 1.366Zm-2.928-5.49L13 13.975V5.24l2.916 1.684a.999.999 0 0 1 .366 1.366ZM7.5 18.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
