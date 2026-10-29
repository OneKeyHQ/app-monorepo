import {
  EARN_OFFERS_MODAL_WIDTH,
  EARN_ROUTER_MODAL_HEIGHT,
} from '../EarnRouter/earnRouter.utils';

// The Loans router's modal: the Earn router's size, the form on the left and
// the markets beside it, taller than a modal's usual 640, so a position's
// figures and the button fit without scrolling
export const EARN_LOAN_MODAL_SIZE = {
  width: EARN_OFFERS_MODAL_WIDTH,
  height: EARN_ROUTER_MODAL_HEIGHT,
} as const;
