import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWcPaperToilet = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 8.75c.414 0 .75.56.75 1.25s-.336 1.25-.75 1.25-.75-.56-.75-1.25.336-1.25.75-1.25" />
    <Path
      fillRule="evenodd"
      d="M17 3c1.411 0 2.42 1.118 3.016 2.31C20.642 6.563 21 8.223 21 10v11H9v-4H7c-1.411 0-2.42-1.118-3.016-2.31C3.36 13.438 3 11.777 3 10s.359-3.438.984-4.69C4.58 4.119 5.59 3 7 3zm-6.984 2.31C10.642 6.563 11 8.223 11 10v9h8v-9c0-1.535-.314-2.876-.773-3.796C17.737 5.225 17.246 5 17 5H9.849q.087.154.167.31M7 5c-.246 0-.737.225-1.227 1.204C5.313 7.124 5 8.464 5 10c0 1.535.314 2.876.773 3.796C6.263 14.775 6.754 15 7 15s.737-.225 1.227-1.204c.46-.92.773-2.26.773-3.796 0-1.535-.314-2.876-.773-3.796C7.737 5.225 7.246 5 7 5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWcPaperToilet;
