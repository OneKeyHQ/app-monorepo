import { atom } from 'jotai';

export interface WelcomeItemAnimationState {
  floatDistance: number;
  floatDuration: number;
  floatDelay: number;
  rotationAngle: number;
  rotationDuration: number;
  rotationDelay: number;
  scaleFactor: number;
  scaleDuration: number;
  scaleDelay: number;
  hasFadeIn: boolean;
}

export const welcomeItemAnimationStateAtom = atom<WelcomeItemAnimationState>({
  floatDistance: 0,
  floatDuration: 0,
  floatDelay: 0,
  rotationAngle: 0,
  rotationDuration: 0,
  rotationDelay: 0,
  scaleFactor: 1,
  scaleDuration: 0,
  scaleDelay: 0,
  hasFadeIn: false,
});
