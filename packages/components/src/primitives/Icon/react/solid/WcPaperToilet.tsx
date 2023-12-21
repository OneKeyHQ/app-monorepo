import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWcPaperToilet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 11.25c.414 0 .75-.56.75-1.25S7.414 8.75 7 8.75s-.75.56-.75 1.25.336 1.25.75 1.25Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.984 14.69C4.58 15.882 5.59 17 7 17h2v1a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-8c0-1.778-.358-3.438-.984-4.69C19.42 4.118 18.41 3 17 3H7C5.589 3 4.58 4.118 3.984 5.31 3.358 6.562 3 8.222 3 10c0 1.778.358 3.438.984 4.69Zm1.79-8.485C5.313 7.125 5 8.465 5 10c0 1.535.313 2.876.773 3.795C6.263 14.775 6.754 15 7 15c.246 0 .737-.225 1.227-1.205.46-.92.773-2.26.773-3.795 0-1.343-.24-2.538-.608-3.431a5.49 5.49 0 0 0-.165-.364C7.737 5.225 7.246 5 7 5c-.246 0-.737.225-1.227 1.205Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWcPaperToilet;
