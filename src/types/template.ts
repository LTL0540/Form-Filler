import type { MappingFile } from './field';

export type TemplatePackage = {
  pdfFile: File;
  mapping: MappingFile;
  mappingFileName?: string;
};
