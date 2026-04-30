import { useEffect, useMemo, useState } from 'react';
import { FieldOverlay } from '../components/FieldOverlay';
import { FilePicker } from '../components/FilePicker';
import { LocalProcessingNotice } from '../components/LocalProcessingNotice';
import { PageControls } from '../components/PageControls';
import { PasteValuesPanel } from '../components/PasteValuesPanel';
import { PdfPageCanvas } from '../components/PdfPageCanvas';
import { downloadBlob } from '../lib/download';
import { fillPdf } from '../lib/pdfFill';
import { loadPdfDocument, type PdfDocument } from '../lib/pdfJs';
import {
  getLineCount,
  getLineWarning,
  mapLinesToFieldValues,
  readMappingFile,
  sortFields,
} from '../lib/mapping';
import { getTemplateMatchResult, type TemplateMatchResult } from '../lib/templateNames';
import type { Field } from '../types/field';

const PREVIEW_SCALE = 1.15;

type FormFillerProps = {
  pdfFile: File | null;
  mappingName: string;
  mappingPdfName: string | undefined;
  mappingFileName: string | undefined;
  fields: Field[];
  values: Record<string, string>;
  pasteText: string;
  pasteWarning: string | null;
  layoutStatus: 'saved' | 'unsaved';
  onPdfFileChange: (file: File | null) => void;
  onMappingNameChange: (name: string) => void;
  onMappingPdfNameChange: (name: string | undefined) => void;
  onMappingFileNameChange: (name: string | undefined) => void;
  onFieldsChange: (fields: Field[]) => void;
  onValuesChange: (values: Record<string, string>) => void;
  onPasteTextChange: (text: string) => void;
  onPasteWarningChange: (warning: string | null) => void;
  onLayoutSaved: () => void;
};

export function FormFiller({
  pdfFile,
  mappingName,
  mappingPdfName,
  mappingFileName,
  fields,
  values,
  pasteText,
  pasteWarning,
  layoutStatus,
  onPdfFileChange,
  onMappingNameChange,
  onMappingPdfNameChange,
  onMappingFileNameChange,
  onFieldsChange,
  onValuesChange,
  onPasteTextChange,
  onPasteWarningChange,
  onLayoutSaved,
}: FormFillerProps) {
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedFields = useMemo(() => sortFields(fields), [fields]);
  const canGenerate = !!pdfFile && orderedFields.length > 0 && !isGenerating;
  const fieldsForPage = useMemo(
    () => fields.filter((field) => field.page === pageNumber),
    [fields, pageNumber],
  );
  const mappingMatch: TemplateMatchResult | null = useMemo(
    () =>
      mappingFileName && mappingPdfName
        ? getTemplateMatchResult(pdfFile?.name, mappingPdfName, mappingFileName)
        : null,
    [mappingFileName, mappingPdfName, pdfFile?.name],
  );
  const hasSessionReadyToFill = !!pdfFile && orderedFields.length > 0;

  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      if (!pdfFile) {
        setPdfDocument(null);
        return;
      }

      setError(null);
      try {
        const document = await loadPdfDocument(pdfFile);
        if (!isCancelled) setPdfDocument(document);
      } catch {
        if (!isCancelled) {
          setError('Could not load that PDF.');
          setPdfDocument(null);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfFile]);

  function handlePdfUpload(file: File) {
    setError(null);
    onPdfFileChange(file);
  }

  async function handleMappingUpload(file: File) {
    setError(null);
    onMappingFileNameChange(file.name);
    onMappingNameChange('Untitled Form Mapping');
    onMappingPdfNameChange(undefined);
    onValuesChange({});
    onPasteTextChange('');
    onPasteWarningChange(null);

    try {
      const mapping = await readMappingFile(file);
      onMappingNameChange(mapping.templateName);
      onMappingPdfNameChange(mapping.templatePdfName);
      onFieldsChange(mapping.fields);
      onLayoutSaved();
    } catch (caught) {
      onFieldsChange([]);
      setError(caught instanceof Error ? caught.message : 'Could not read Mapping File.');
    }
  }

  function applyPastedLines() {
    const lineCount = getLineCount(pasteText);
    onValuesChange({
      ...values,
      ...mapLinesToFieldValues(orderedFields, pasteText),
    });
    onPasteWarningChange(getLineWarning(lineCount, orderedFields.length));
  }

  function clearValues() {
    onValuesChange({});
    onPasteTextChange('');
    onPasteWarningChange(null);
  }

  async function generateFilledPdf() {
    if (!pdfFile) return;

    setIsGenerating(true);
    setError(null);

    try {
      const bytes = await fillPdf(pdfFile, orderedFields, values);
      downloadBlob(
        new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
        makeFilledFileName(pdfFile.name),
      );
    } catch (caught) {
      console.error(caught);
      setError(getPdfGenerationError(caught));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="toolbar">
        <div className="upload-control">
          <FilePicker
            id="filler-pdf"
            label="PDF"
            accept=".pdf,application/pdf"
            fileName={pdfFile?.name}
            onChange={handlePdfUpload}
          />
          <p className="upload-note">Upload PDF only. Word documents should be saved as PDF before use.</p>
        </div>
        <FilePicker
          id="mapping-json"
          label="Load Mapping File"
          accept=".json,application/json"
          fileName={mappingFileName}
          onChange={handleMappingUpload}
        />
      </section>

      {error && <p className="error-text">{error}</p>}
      {mappingName && <p className="template-status">{mappingName}</p>}
      <p className={layoutStatus === 'unsaved' ? 'warning-text' : 'success-text'}>
        Form Mapping: {layoutStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}
      </p>
      {mappingMatch && (
        <p className={mappingMatch.kind === 'confirmed' ? 'success-text' : 'warning-text'}>
          {mappingMatch.message}
        </p>
      )}

      <LocalProcessingNotice />

      <section className="filler-workspace">
        <div className="form-shell">
          {!hasSessionReadyToFill ? (
            <div className="drop-placeholder">
              Load a PDF and Mapping File, or create a form mapping in Form Setup first.
            </div>
          ) : (
            <form
              className="generated-form"
              onSubmit={(event) => {
                event.preventDefault();
                generateFilledPdf();
              }}
            >
              <PasteValuesPanel
                value={pasteText}
                warning={pasteWarning}
                disabled={orderedFields.length === 0}
                onChange={(value) => {
                  onPasteTextChange(value);
                  onPasteWarningChange(getLineWarning(getLineCount(value), orderedFields.length));
                }}
                onApply={applyPastedLines}
                onClear={clearValues}
              />
              <div className="form-grid">
                {orderedFields.map((field) => (
                  <label key={`${field.page}-${field.key}`}>
                    {field.label}
                    <input
                      className="value-input"
                      value={values[field.key] ?? ''}
                      autoComplete="off"
                      onChange={(event) =>
                        onValuesChange({
                          ...values,
                          [field.key]: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="form-actions">
                <button type="submit" disabled={!canGenerate}>
                  {isGenerating ? 'Generating' : 'Print Completed Form'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="pdf-pane filler-preview">
          <PageControls
            pageNumber={pageNumber}
            pageCount={pdfDocument?.numPages ?? 0}
            onPageChange={setPageNumber}
          />
          {pdfDocument ? (
            <div
              className="pdf-stage"
              style={{ width: pageSize.width, minHeight: pageSize.height }}
            >
              <PdfPageCanvas
                pdfDocument={pdfDocument}
                pageNumber={pageNumber}
                scale={PREVIEW_SCALE}
                onPageSize={setPageSize}
              />
              <FieldOverlay
                fields={fieldsForPage}
                activeKey={null}
                fieldValues={values}
                locked
                scale={PREVIEW_SCALE}
              />
            </div>
          ) : (
            <div className="drop-placeholder">Upload a PDF to preview the completed form.</div>
          )}
        </div>
      </section>
    </main>
  );
}

function makeFilledFileName(fileName: string) {
  return fileName.replace(/\.pdf$/i, '') + '-filled.pdf';
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function getPdfGenerationError(caught: unknown) {
  if (caught instanceof Error && caught.message) {
    if (caught.message.includes('WinAnsi')) {
      return 'Could not generate the filled PDF because one field contains characters unsupported by the built-in PDF font.';
    }
    return `Could not generate the filled PDF. ${caught.message}`;
  }

  return 'Could not generate the filled PDF.';
}
