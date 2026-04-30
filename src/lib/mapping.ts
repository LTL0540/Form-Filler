import type { Field, MappingFile } from '../types/field';

export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_LINE_HEIGHT = 1.15;

export function sortFields(fields: Field[]) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const orderA = a.field.order ?? a.index + 1;
      const orderB = b.field.order ?? b.index + 1;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map(({ field }) => field);
}

export function normalizeFieldOrders(fields: Field[]) {
  return fields.map((field, index) => ({
    ...field,
    type: field.type ?? 'text',
    order: field.order ?? index + 1,
    fontSize: field.fontSize ?? DEFAULT_FONT_SIZE,
    lineHeight: field.lineHeight ?? DEFAULT_LINE_HEIGHT,
  }));
}

export function createMapping(
  templateName: string,
  templatePdfName: string | undefined,
  fields: Field[],
): MappingFile {
  const orderedFields = sortFields(normalizeFieldOrders(fields));

  return {
    version: 1,
    templateName: templateName.trim() || 'Untitled Form Mapping',
    templatePdfName,
    fields: orderedFields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      page: field.page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      order: field.order,
      fontSize: field.fontSize,
      lineHeight: field.lineHeight,
    })),
  };
}

export async function readMappingFile(file: File): Promise<MappingFile> {
  const raw = JSON.parse(await file.text()) as Partial<MappingFile> | Field[];
  const mapping = Array.isArray(raw)
    ? { version: 1 as const, templateName: 'Imported Form Mapping', fields: raw }
    : raw;

  if (mapping.version !== 1 || !Array.isArray(mapping.fields)) {
    throw new Error('Mapping File must include version: 1 and a fields array.');
  }

  const normalizedFields = normalizeFieldOrders(mapping.fields as Field[]);
  const keys = new Set<string>();
  for (const field of normalizedFields) {
    if (!field.key || keys.has(field.key)) {
      throw new Error('Every field in the mapping must have a unique key.');
    }
    if (field.type !== 'text') {
      throw new Error('Only text fields are supported in this MVP.');
    }
    if (
      !Number.isFinite(field.page) ||
      !Number.isFinite(field.x) ||
      !Number.isFinite(field.y) ||
      !Number.isFinite(field.width) ||
      !Number.isFinite(field.height) ||
      !Number.isFinite(field.order) ||
      !Number.isFinite(field.fontSize) ||
      !Number.isFinite(field.lineHeight)
    ) {
      throw new Error(
        'Every field must include numeric page, x, y, width, height, order, fontSize, and lineHeight values.',
      );
    }
    keys.add(field.key);
  }

  return {
    version: 1,
    templateName: mapping.templateName?.trim() || 'Imported Form Mapping',
    templatePdfName: mapping.templatePdfName,
    fields: sortFields(normalizedFields),
  };
}

export function getLineCount(text: string) {
  if (!text) return 0;
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
}

export function mapLinesToFieldValues(fields: Field[], text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  return sortFields(fields).reduce<Record<string, string>>((result, field, index) => {
    result[field.key] = lines[index] ?? '';
    return result;
  }, {});
}

export function getLineWarning(lineCount: number, fieldCount: number) {
  const difference = Math.abs(lineCount - fieldCount);
  if (lineCount > fieldCount) {
    return `${difference} pasted line${difference === 1 ? '' : 's'} will not map to a field.`;
  }
  if (lineCount < fieldCount) {
    return `${difference} field${difference === 1 ? '' : 's'} will remain empty.`;
  }
  return null;
}
