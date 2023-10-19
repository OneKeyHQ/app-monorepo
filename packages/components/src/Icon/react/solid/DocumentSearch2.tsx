import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentSearch2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h4.81A6.5 6.5 0 0 1 20 12.022V5a3 3 0 0 0-3-3H7Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16.5 13a4.5 4.5 0 1 0 2.414 8.298l.867.897a1 1 0 0 0 1.438-1.39l-.898-.928A4.5 4.5 0 0 0 16.5 13ZM14 17.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentSearch2;
