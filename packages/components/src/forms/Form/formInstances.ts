import type { UseFormReturn } from 'react-hook-form';

const formInstances: UseFormReturn<any>[] = [];

export function getFormInstances(): UseFormReturn<any>[] {
  return formInstances;
}

export function addFormInstance(instance: UseFormReturn<any>): void {
  if (!formInstances.includes(instance)) {
    formInstances.push(instance);
  }
}

export function removeFormInstance(instance: UseFormReturn<any>): void {
  const index = formInstances.indexOf(instance);
  if (index !== -1) {
    formInstances.splice(index, 1);
  }
}
