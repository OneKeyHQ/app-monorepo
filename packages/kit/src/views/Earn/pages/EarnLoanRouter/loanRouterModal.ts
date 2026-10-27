import { EARN_OFFERS_MODAL_WIDTH } from '../EarnRouter/earnRouter.utils';

// The Loans router's modal: the deposit modal's width, the form on the left
// and the markets beside it, and taller than a modal's usual 640, so a
// position's figures and the button fit without scrolling
export const EARN_LOAN_MODAL_SIZE = {
  width: EARN_OFFERS_MODAL_WIDTH,
  height: 800,
} as const;
