export type LocaleKeyInfoMap = {
  form__gas_limit_invalid_min: {
    0: number;
    1: number;
    // je: string;
  };
  form__gas_price_invalid_min_str: {
    0: number | string;
  };
  form__max_fee_invalid_too_low: {
    0: number | string;
  };
  form__max_priority_fee_invalid_min: {
    0: number | string;
  };
  msg__custom_fee_warning_max_fee_is_lower_than_priority_fee: object;
  msg__insufficient_balance: object;
  form__gas_limit_invalid_too_much: object;
  form__gas_price_invalid_too_low: object;
  msg__custom_fee_warning_max_fee_is_high: object;
  msg__custom_fee_warning_max_fee_is_low: object;
  msg__custom_fee_warning_priority_fee_is_low: object;
  msg__custom_fee_warning_priority_fee_is_high: object;
  form__gas_price_invalid_too_much: object;
  msg__fee_rate_is_low_for_current_network: object;
  msg__fee_rate_is_higher_than_necessary: object;
  msg__enter_a_fee_rate_between_str_and_str: {
    min: string;
    max: string;
  };
  others: {
    hello_world: string;
  };
};
