export type FieldType = 'text';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  order?: number;
  fontSize?: number;
  lineHeight?: number;
};

export type MappingFile = {
  version: 1;
  templateName: string;
  templatePdfName?: string;
  fields: Field[];
};
