import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloseQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 13c0 2.585-1.162 4.335-2.316 5.417a8.2 8.2 0 0 1-2.098 1.42 5 5 0 0 1-.21.089l-.015.007q-.003 0-.006.002h-.001c-.001 0-.003.001-.354-.935l.352.936L5 20.444V14H2V4h9zm-7-1h3v5.233q.157-.127.316-.275C8.162 16.165 9 14.915 9 13V6H4zm18.004 1c0 2.585-1.162 4.335-2.317 5.417a8.2 8.2 0 0 1-2.097 1.42 5 5 0 0 1-.21.089l-.015.007q-.003 0-.006.002h-.002L17.004 19l.351.936-1.35.506L16 14h-3l.004-10h9zM15 12h2.999l.003 5.234q.158-.127.318-.276c.846-.793 1.684-2.043 1.684-3.958V6h-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloseQuote;
