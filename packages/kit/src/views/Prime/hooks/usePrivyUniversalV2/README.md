```
/**
 * Use this hook to update a users account and to attach callbacks
 * for successful `updateAccount`, and`updateAccount` errors.
 *
 * @param callbacks.onSuccess {@link PrivyEvents} callback to execute for after successful account update
 * @param callbacks.onError {@link PrivyEvents} callback to execute if there is an error during `updatePhone` or `updateEmail`.
 * @returns updateEmail - opens the Privy modal and prompts the user to update email
 * @returns updatePhone - opens the Privy modal and prompts the user to update phone number
 */
declare function useUpdateAccount(callbacks?: PrivyEvents['update']): {
    /**
     * Opens the Privy modal and prompts the user to update their accont.
     */
    updateEmail: () => void;
    updatePhone: () => void;
};
```
