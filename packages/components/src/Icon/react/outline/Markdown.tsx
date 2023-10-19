import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMarkdown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.59 9.088a1 1 0 0 1 1.074.165l1.586 1.41 1.586-1.41A1 1 0 0 1 12.5 10v4a1 1 0 1 1-2 0v-1.773l-.586.52a1 1 0 0 1-1.328 0L8 12.227V14a1 1 0 1 1-2 0v-4a1 1 0 0 1 .59-.912Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M17 10a1 1 0 0 0-2 0v2h-.612a.75.75 0 0 0-.514 1.296l1.611 1.519a.75.75 0 0 0 1.029 0l1.611-1.52A.75.75 0 0 0 17.611 12H17v-2Z"
    />
  </Svg>
);
export default SvgMarkdown;
