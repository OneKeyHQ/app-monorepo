enum ETHMessageTypes {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPED_DATA_V1 = 2,
  TYPED_DATA_V3 = 3,
  TYPED_DATA_V4 = 4,
}

type ETHMessage = {
  type: ETHMessageTypes;
  message: string;
};

type Message = string | ETHMessage;

export { ETHMessageTypes };
export type { ETHMessage, Message };
