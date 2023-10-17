import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.566 9H13.5a.5.5 0 0 1-.5-.5V2.401a.5.5 0 0 0-.916-.277L4.018 14.223a.5.5 0 0 0 .416.777H10.5a.5.5 0 0 1 .5.5v6.099a.5.5 0 0 0 .916.277l8.066-12.099A.5.5 0 0 0 19.566 9Z"
    />
    <Path
      fill="currentColor"
      d="M15.909 21.46a1 1 0 0 0 1.682 1.08l-1.682-1.08ZM21.25 15l.978-.21a1 1 0 0 0-1.82-.33l.842.54Zm.522 7.21a1 1 0 1 0 1.956-.42l-1.956.42Zm-4.18.33 4.5-7-1.683-1.08-4.5 7 1.682 1.08Zm2.68-7.33 1.5 7 1.956-.42-1.5-7-1.956.42ZM18 21.5h4v-2h-4v2Z"
    />
  </Svg>
);
export default SvgAutoFlash;
