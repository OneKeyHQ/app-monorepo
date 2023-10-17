import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddPeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM7.003 13.571c-1.347.975-2.368 2.346-2.959 3.945a9.24 9.24 0 0 0-.348 1.18C3.406 19.986 4.463 21 5.598 21H15a3 3 0 1 1 0-6c0-.824.332-1.57.87-2.113C14.736 12.32 13.432 12 12 12a8.97 8.97 0 0 0-.494.013"
    />
    <Path
      fill="currentColor"
      d="M18 14a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z"
    />
  </Svg>
);
export default SvgAddPeople;
