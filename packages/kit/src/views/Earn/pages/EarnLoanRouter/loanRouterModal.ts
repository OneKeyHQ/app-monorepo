import { EARN_OFFERS_MODAL_WIDTH } from '../EarnRouter/earnRouter.utils';

// The Loans router's modal: the Earn router's width, the form on the left and
// the markets beside it, and one fixed height taller than a modal's usual
// 640: its form holds two amounts, the LTV bar and the two results, so the
// button under them and the rows after it fit without scrolling
export const EARN_LOAN_MODAL_SIZE = {
  width: EARN_OFFERS_MODAL_WIDTH,
  height: 720,
} as const;
