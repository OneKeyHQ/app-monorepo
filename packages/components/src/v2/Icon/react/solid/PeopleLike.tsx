import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleLike = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.5 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM12 12c-3.832 0-6.765 2.296-7.956 5.516-.34.92-.107 1.828.434 2.473A2.898 2.898 0 0 0 6.696 21h6.402C12.471 20.103 12 18.992 12 17.75c0-2.03 1.278-4.44 3.761-4.916A8.624 8.624 0 0 0 12 12Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16.667 14.75c-.685 0-1.369.275-1.876.816-.511.546-.791 1.303-.791 2.184 0 1.428.998 2.519 1.77 3.156.412.341.831.612 1.17.8.17.094.328.173.465.232.068.029.142.058.215.081l.003.001c.045.015.197.063.377.063s.332-.048.377-.063h.003a2.46 2.46 0 0 0 .215-.082c.137-.059.296-.138.465-.232a7.91 7.91 0 0 0 1.17-.8c.772-.637 1.77-1.728 1.77-3.156 0-.88-.28-1.638-.791-2.184a2.565 2.565 0 0 0-1.876-.816c-.549 0-1 .146-1.333.308a3.035 3.035 0 0 0-1.333-.308Zm-.667 3c0-.453.137-.695.25-.816a.565.565 0 0 1 .417-.184 1.04 1.04 0 0 1 .625.21l.016.012a1 1 0 0 0 1.384 0l.015-.013a1.04 1.04 0 0 1 .626-.21c.149.001.299.06.417.185.113.12.25.363.25.816 0 .489-.377 1.064-1.043 1.614a5.92 5.92 0 0 1-.957.642 5.92 5.92 0 0 1-.957-.641C16.377 18.814 16 18.238 16 17.75Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleLike;
