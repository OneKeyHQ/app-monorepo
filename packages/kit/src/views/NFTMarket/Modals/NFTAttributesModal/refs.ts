// attributes_name--attributes_value
type Refs = Record<string, boolean>;

const selectedAttributes: Refs = {};

function setAttributesStatus({
  attributeName,
  attributesValue,
  enable,
}: {
  attributeName: string;
  attributesValue: string;
  enable: boolean;
}) {
  const key = `${attributeName}--${attributesValue}`;
  selectedAttributes[key] = enable;
}

function getAttributesStatus({
  attributeName,
  attributesValue,
}: {
  attributeName: string;
  attributesValue: string;
}) {
  const key = `${attributeName}--${attributesValue}`;
  if (selectedAttributes[key]) {
    return selectedAttributes[key];
  }
  return false;
}

function clearAttributeStatus() {
  for (const [key] of Object.entries(selectedAttributes)) {
    delete selectedAttributes[key];
  }
}

function generteAttributeParams() {
  const map: Record<string, string[]> = {};
  for (const [key, enable] of Object.entries(selectedAttributes)) {
    if (enable) {
      const attributeName = key.split('--')[0];
      const attributesValue = key.split('--')[1];
      const items = map[attributeName] ?? [];
      items.push(attributesValue);
      map[attributeName] = items;
    }
  }
  return Object.entries(map).map(([key, values]) => ({
    attribute_name: key,
    attribute_values: values,
  }));
}

function isSelectedAttribute() {
  for (const [, enable] of Object.entries(selectedAttributes)) {
    if (enable) {
      return true;
    }
  }
  return false;
}

function isAttributeNameSelected(attributeName: string) {
  for (const [key, enable] of Object.entries(selectedAttributes)) {
    if (key.split('--')[0] === attributeName && enable) {
      return true;
    }
  }
  return false;
}

export {
  isSelectedAttribute,
  setAttributesStatus,
  getAttributesStatus,
  clearAttributeStatus,
  generteAttributeParams,
  isAttributeNameSelected,
};
