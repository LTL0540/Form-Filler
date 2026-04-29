import { useEffect, useMemo, useState } from 'react';
import { FilePicker } from '../components/FilePicker';
import { LocalProcessingNotice } from '../components/LocalProcessingNotice';
import { PasteValuesPanel } from '../components/PasteValuesPanel';
import { downloadBlob } from '../lib/download';
import { fillPdf } from '../lib/pdfFill';
import {
  getLineCount,
  getLineWarning,
  mapLinesToFieldValues,
  readMappingFile,
  sortFields,
} from '../lib/mapping';
import { getTemplateMatchResult, type TemplateMatchResult } from '../lib/templateNames';
import type { Field } from '../types/field';
import type { TemplatePackage } from '../types/template';

type FormFillerProps = {
  initialTemplate: TemplatePackage | null;
};

export function FormFiller({ initialTemplate }: FormFillerProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mappingFileName, setMappingFileName] = useState<string | undefined>();
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [templatePdfName, setTemplatePdfName] = useState<string | undefined>();
  const [templateMatch, setTemplateMatch] = useState<TemplateMatchResult | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState('');
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedFields = useMemo(() => sortFields(fields), [fields]);
  const canGenerate = !!pdfFile && orderedFields.length > 0 && !isGenerating;

  useEffect(() => {
    if (!initialTemplate) return;

    setPdfFile(initialTemplate.pdfFile);
    setMappingFileName(initialTemplate.mappingFileName);
    setTemplateName(initialTemplate.mapping.templateName);
    setTemplatePdfName(initialTemplate.mapping.templatePdfName);
    setTemplateMatch(
      getTemplateMatchResult(
        initialTemplate.pdfFile.name,
        initialTemplate.mapping.templatePdfName,
        initialTemplate.mappingFileName,
      ),
    );
    setFields(initialTemplate.mapping.fields);
    setValues({});
    setPasteText('');
    setPasteWarning(null);
    setError(null);
  }, [initialTemplate]);

  function handlePdfUpload(file: File) {
    setPdfFile(file);
    setTemplateMatch(
      getTemplateMatchResult(file.name, templatePdfName, mappingFileName),
    );
  }

  async function handleMappingUpload(file: File) {
    setError(null);
    setMappingFileName(file.name);
    setTemplateName(null);
    setTemplatePdfName(undefined);
    setTemplateMatch(null);
    setValues({});
    setPasteText('');
    setPasteWarning(null);

    try {
      const mapping = await readMappingFile(file);
      setTemplateName(mapping.templateName);
      setTemplatePdfName(mapping.templatePdfName);
      setTemplateMatch(
        getTemplateMatchResult(pdfFile?.name, mapping.templatePdfName, file.name),
      );
      setFields(mapping.fields);
    } catch (caught) {
      setFields([]);
      setError(caught instanceof Error ? caught.message : 'Could not read mapping JSON.');
    }
  }

  function applyPastedLines() {
    const lineCount = getLineCount(pasteText);
    setValues((current) => ({
      ...current,
      ...mapLinesToFieldValues(orderedFields, pasteText),
    }));
    setPasteWarning(getLineWarning(lineCount, orderedFields.length));
  }

  function clearValues() {
    setValues({});
    setPasteText('');
    setPasteWarning(null);
  }

  async function generateFilledPdf() {
    if (!pdfFile) return;

    setIsGenerating(true);
    setError(null);

    try {
      const pastedValues = pasteText
        ? mapLinesToFieldValues(orderedFields, pasteText)
        : {};
      const bytes = await fillPdf(pdfFile, orderedFields, {
        ...pastedValues,
        ...values,
      });
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

  function clearSession() {
    if (
      !window.confirm(
        'Clear the current PDF, template, pasted text, and entered values from this browser session?',
      )
    ) {
      return;
    }

    setPdfFile(null);
    setMappingFileName(undefined);
    setTemplateName(null);
    setTemplatePdfName(undefined);
    setTemplateMatch(null);
    setFields([]);
    setValues({});
    setPasteText('');
    setPasteWarning(null);
    setError(null);
  }

  return (
    <main className="page-shell">
      <section className="toolbar">
        <FilePicker
          id="filler-pdf"
          label="PDF"
          accept=".pdf,application/pdf"
          fileName={pdfFile?.name}
          onChange={handlePdfUpload}
        />
        <FilePicker
          id="mapping-json"
          label="Import Template JSON"
          accept=".json,application/json"
          fileName={mappingFileName}
          onChange={handleMappingUpload}
        />
      </section>

      {error && <p className="error-text">{error}</p>}
      {templateName && <p className="template-status">Template: {templateName}</p>}
      {templateMatch && (
        <p className={templateMatch.kind === 'confirmed' ? 'success-text' : 'warning-text'}>
          {templateMatch.message}
        </p>
      )}

      <LocalProcessingNotice />

      <section className="form-shell">
        {orderedFields.length === 0 ? (
          <div className="drop-placeholder">Upload a mapping JSON to generate form fields.</div>
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
                setPasteText(value);
                setPasteWarning(getLineWarning(getLineCount(value), orderedFields.length));
              }}
              onApply={applyPastedLines}
              onClear={clearValues}
            />
            <div className="form-grid">
              {orderedFields.map((field) => (
                <label key={`${field.page}-${field.key}`}>
                  {field.label}
                  <input
                    value={values[field.key] ?? ''}
                    autoComplete="off"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button type="submit" disabled={!canGenerate}>
                {isGenerating ? 'Generating' : 'Generate Filled PDF'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="session-panel">
        <div>
          <h2>Session</h2>
          <p>Clears uploaded files and entered values from memory.</p>
        </div>
        <button type="button" className="danger" onClick={clearSession}>
          Clear Session
        </button>
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
