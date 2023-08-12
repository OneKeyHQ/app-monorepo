import { mvs, s } from 'react-native-size-matters/extend';

import { metrics } from '../constants/metrics';

import type { CardContentProps } from './types';

/* eslint-disable @typescript-eslint/no-unsafe-call */
export const CARD_HEIGHT_CLOSED = s(224);
export const CARD_HEIGHT_OPEN = s(590);
export const CARD_IMAGE_HEIGTH = s(165);
export const CARD_HEADER_HEIGHT = s(59);
export const CARD_MARGIN = mvs(70);
export const BACK_BUTTON_HEIGHT = s(40);
export const CLOSE_THRESHOLD = metrics.screenHeight * 0.11;
/* eslint-enable @typescript-eslint/no-unsafe-call */

export const SPRING_CONFIG = {
  OPEN: {
    mass: 0.8,
    stiffness: 80,
  },
  CLOSE: {
    mass: 0.8,
    damping: 11,
    stiffness: 87,
  },
  SWIPE: {
    mass: 0.7,
    stiffness: 80,
  },
};

export const CARDS: CardContentProps[] = [
  {
    title: 'GameHub',
    headerField: {
      label: 'Points',
      value: '1337',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'GH-007',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card1.png'),
    bg: '#007A96',
  },
  {
    title: 'Sky Train',
    headerField: {
      label: 'Balance',
      value: '$102',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'ST-845037',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card2.png'),
    bg: '#9C312D',
  },
  {
    title: 'Vintage Blooms',
    headerField: {
      label: 'Tier',
      value: 'Gold',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'VB-338',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card3.png'),
    bg: '#1D8F88',
  },
  {
    title: 'Metro',
    headerField: {
      label: 'Balance',
      value: '$37.02',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'M-76430',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card4.png'),
    bg: '#179C60',
  },
  {
    title: 'Higher Grounds',
    headerField: {
      label: 'Points',
      value: '1900',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'GR-2728',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card5.png'),
    bg: '#764133',
  },
  {
    title: 'Dreamcatchers',
    headerField: {
      label: 'Tier',
      value: 'Silver',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'DC-1303',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card7.png'),
    bg: '#2B6391',
  },
  {
    title: 'Waves',
    headerField: {
      label: 'Valid Till',
      value: '12/25',
    },
    auxiliaryField: {
      label: 'Name',
      value: 'John Doe',
    },
    secondaryField: {
      label: 'Member ID',
      value: 'W-76235',
    },
    tertiaryField: {
      label: 'Member since',
      value: '2017',
    },
    image: require('./images/card6.png'),
    bg: '#41A02F',
  },
];
