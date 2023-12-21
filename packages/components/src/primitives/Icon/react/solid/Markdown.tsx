import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMarkdown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Zm5.664 4.253A1 1 0 0 0 6 10v4a1 1 0 1 0 2 0v-1.773l.586.52a1 1 0 0 0 1.328 0l.586-.52V14a1 1 0 1 0 2 0v-4a1 1 0 0 0-1.664-.747l-1.586 1.41-1.586-1.41ZM16 9a1 1 0 0 1 1 1v2h.61a.75.75 0 0 1 .515 1.296l-1.611 1.519a.75.75 0 0 1-1.029 0l-1.611-1.52A.75.75 0 0 1 14.388 12H15v-2a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMarkdown;
