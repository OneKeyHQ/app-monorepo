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
      d="M9.004 4c1.103 0 1.999.893 1.999 1.999v7c0 2.586-1.161 4.336-2.316 5.418a8.2 8.2 0 0 1-1.568 1.15 7 7 0 0 1-.69.34l-.048.019-.017.007-.005.001-.003.001L6.004 19l.35.936a1 1 0 0 1-1.35-.935L5 14H4a2 2 0 0 1-1.99-1.797L2 11.999l.003-6a2 2 0 0 1 2-2zM4 12h1.999a1 1 0 0 1 1 .999l.003 4.235q.158-.127.317-.276c.846-.793 1.684-2.043 1.684-3.958V6h-5zm16-8a2 2 0 0 1 2 1.999v7c0 2.586-1.162 4.336-2.316 5.418a8.2 8.2 0 0 1-2.098 1.42q-.1.045-.16.07l-.049.019-.016.007-.006.001-.002.001s-.002.001-.353-.935l.352.936A1 1 0 0 1 16 19v-5h-1a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm-5 8h2a1 1 0 0 1 1 1v4.233a6 6 0 0 0 .316-.275C19.162 16.165 20 14.915 20 13V6h-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloseQuote;
