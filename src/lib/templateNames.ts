export type TemplateMatchResult = {
  kind: 'confirmed' | 'warning';
  message: string;
};

export function getMappingFileName(pdfFileName?: string) {
  if (!pdfFileName) return 'form-MAPPING.json';
  return `${stripPdfExtension(pdfFileName)}-MAPPING.json`;
}

export function getFlattenedPdfFileName(pdfFileName?: string) {
  if (!pdfFileName) return 'field-mapping.flattened.pdf';
  return `${stripPdfExtension(pdfFileName)}.flattened.pdf`;
}

export function getTemplateMatchResult(
  pdfFileName: string | undefined,
  templatePdfName: string | undefined,
  mappingFileName?: string,
): TemplateMatchResult | null {
  if (!pdfFileName) return null;

  const pdfBase = normalizeBaseName(stripPdfExtension(pdfFileName));
  const templatePdfBase = templatePdfName
    ? normalizeBaseName(stripPdfExtension(templatePdfName))
    : null;
  const mappingBase = mappingFileName
    ? normalizeBaseName(stripMappingExtension(mappingFileName))
    : null;

  if (templatePdfBase === pdfBase || mappingBase === pdfBase) {
    return {
      kind: 'confirmed',
      message: 'Layout match confirmed.',
    };
  }

  const expectedName = templatePdfName || mappingFileName || 'the imported mapping';
  return {
    kind: 'warning',
    message: `Field layout PDF mismatch: uploaded PDF is ${pdfFileName}, but the layout references ${expectedName}. You can continue if this is intentional.`,
  };
}

function stripPdfExtension(fileName: string) {
  return fileName.replace(/\.pdf$/i, '');
}

function stripMappingExtension(fileName: string) {
  return fileName
    .replace(/\.mapping\.json$/i, '')
    .replace(/-mapping\.json$/i, '')
    .replace(/\.json$/i, '')
    .replace(/\.pdf$/i, '');
}

function normalizeBaseName(value: string) {
  return value.trim().toLowerCase().replace(/\.(flattened|printed)$/i, '');
}
