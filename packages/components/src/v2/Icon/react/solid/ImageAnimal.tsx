import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageAnimal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.29 16.006c.57-.153.883-.832.7-1.516-.184-.684-.795-1.115-1.365-.962-.57.152-.884.831-.7 1.515.183.684.794 1.115 1.364.963Zm4.778.489c.123.457-.333.975-1.017 1.158-.684.184-1.338-.037-1.46-.494-.123-.456.333-.974 1.017-1.157.684-.184 1.338.037 1.46.494Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm9.877 6.319a9.683 9.683 0 0 0-2.392.994L8.98 9.499a.5.5 0 0 0-.605.575l.744 4.117c-.324.944-.385 1.936-.126 2.902.152.565.402 1.083.735 1.547a.9.9 0 0 0 .741.36H18a1 1 0 0 0 1-1v-3.658c-.398-.108-.75-.468-.88-.959-.184-.684.13-1.362.7-1.515a.908.908 0 0 1 .18-.03V7.734a.1.1 0 0 0-.169-.073l-1.386 1.323a9.685 9.685 0 0 0-2.568.335Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageAnimal;
