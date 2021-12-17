import React from 'react';

import { Controller, useForm } from 'react-hook-form';

import {
  Box,
  Button,
  Center,
  CheckBox,
  FormControl,
  Icon,
  Input,
  Textarea,
} from '@onekeyhq/components';

type FormValues = {
  username: string;
  email: string;
  description: string;
  agreement: boolean;
};

const FormGallery = () => {
  const { handleSubmit, control } = useForm<FormValues>();
  const onSubmit = handleSubmit((data) => console.log(data));
  return (
    <Center flex="1" background="background-hovered">
      <Box>
        <Controller
          control={control}
          name="username"
          rules={{
            required: 'Username cannot be empty',
            maxLength: { value: 10, message: 'The maximum length is 10.' },
          }}
          defaultValue=""
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <FormControl isInvalid={!!error}>
              <FormControl.Label>Username</FormControl.Label>
              <Input
                placeholder="username"
                onChangeText={onChange}
                value={value}
                onBlur={onBlur}
              />
              <FormControl.ErrorMessage>
                {error?.message}
              </FormControl.ErrorMessage>
            </FormControl>
          )}
        />
        <Controller
          control={control}
          name="email"
          defaultValue=""
          rules={{
            required: 'Email cannot be empty',
            pattern: {
              value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
              message: 'Email address format error',
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <FormControl isInvalid={!!error}>
              <FormControl.Label>Email</FormControl.Label>
              <Input
                placeholder="email"
                onChangeText={onChange}
                value={value}
                onBlur={onBlur}
              />
              <FormControl.ErrorMessage>
                {error?.message}
              </FormControl.ErrorMessage>
            </FormControl>
          )}
        />
        <Controller
          control={control}
          name="description"
          rules={{ required: 'description cannot be empty' }}
          defaultValue=""
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <FormControl isInvalid={!!error}>
              <FormControl.Label>Description</FormControl.Label>
              <Textarea
                placeholder="description"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              <FormControl.HelperText>
                write something about yourself
              </FormControl.HelperText>
              <FormControl.ErrorMessage
                startIcon={<Icon size={16} name="ExclamationCircleOutline" />}
              >
                {error?.message}
              </FormControl.ErrorMessage>
            </FormControl>
          )}
        />
        <Controller
          name="agreement"
          control={control}
          defaultValue={false}
          rules={{ required: 'your need to agree it' }}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <FormControl isInvalid={!!error} mt={2}>
              <CheckBox
                title="agreement"
                isChecked={value}
                onChange={onChange}
              />
              <FormControl.ErrorMessage
                startIcon={<Icon size={16} name="ExclamationCircleOutline" />}
              >
                {error?.message}
              </FormControl.ErrorMessage>
            </FormControl>
          )}
        />
        <Button mt="4" onPress={onSubmit}>
          Submit
        </Button>
      </Box>
    </Center>
  );
};

export default FormGallery;
