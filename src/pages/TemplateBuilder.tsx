import { useCallback, useMemo, useState } from 'react';
import { CoordinateDebugOverlay } from '../components/CoordinateDebugOverlay';
import { FieldEditor } from '../components/FieldEditor';
import { FieldOverlay } from '../components/FieldOverlay';
import { FilePicker } from '../components/FilePicker';
import { PageControls } from '../components/PageControls';
import { PdfPageCanvas } from '../components/PdfPageCanvas';
import { downloadBlob, downloadJson } from '../lib/download';
import { flattenPdf } from '../lib/pdfFill';
import { loadPdfDocument, type PdfDocument } from '../lib/pdfJs';
import { createMapping, readMappingFile } from '../lib/mapping';
import {
  getFlattenedPdfFileName,
  getMappingFileName,
  getTemplateMatchResult,
  type TemplateMatchResult,
} from '../lib/templateNames';
import type { Field } from '../types/field';
import type { TemplatePackage } from '../types/template';

const RENDER_SCALE = 1.3;

type TemplateBuilderProps = {
  onUseTemplate: (templatePackage: TemplatePackage) => void;
};

export function TemplateBuilder({ onUseTemplate }: TemplateBuilderProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [templateName, setTemplateName] = useState('Untitled Template');
  const [templatePdfName, setTemplatePdfName] = useState<string | undefined>();
  const [mappingFileName, setMappingFileName] = useState<string | undefined>();
  const [templateMatch, setTemplateMatch] = useState<TemplateMatchResult | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState<Field[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [isFlattening, setIsFlattening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldsForPage = useMemo(
    () => fields.filter((field) => field.page === pageNumber),
    [fields, pageNumber],
  );
  const activeField = fields.find((field) => field.key === activeKey) ?? null;
  const hasInvalidKeys = fields.some(
    (field, index) =>
      !field.key || fields.findIndex((candidate) => candidate.key === field.key) !== index,
  );
  const canExport = !!pdfFile && fields.length > 0 && !hasInvalidKeys;

  async function handlePdfUpload(file: File) {
    setError(null);
    setPdfFile(file);
    setTemplateMatch(
      getTemplateMatchResult(file.name, templatePdfName, mappingFileName),
    );
    if (fields.length === 0) {
      setTemplateName(file.name.replace(/\.pdf$/i, '') || 'Untitled Template');
    }
    setPageNumber(1);

    try {
      setPdfDocument(await loadPdfDocument(file));
    } catch {
      setError('Could not load that PDF.');
      setPdfDocument(null);
    }
  }

  function addField() {
    const nextIndex = fields.length + 1;
    const key = makeUniqueKey(`field_${nextIndex}`, fields);
    const field: Field = {
      key,
      label: `Field ${nextIndex}`,
      type: 'text',
      page: pageNumber,
      x: Math.round(24 / RENDER_SCALE),
      y: Math.round(24 / RENDER_SCALE),
      width: Math.round(180 / RENDER_SCALE),
      height: Math.round(32 / RENDER_SCALE),
      order: nextIndex,
    };

    setFields((current) => [...current, field]);
    setActiveKey(field.key);
  }

  const updateField = useCallback((key: string, patch: Partial<Field>) => {
    setError(null);
    if (patch.key !== undefined) {
      if (!patch.key) {
        setError('Field keys cannot be empty.');
        return;
      }
      if (patch.key !== key && fields.some((field) => field.key === patch.key)) {
        setError('Field keys must be unique.');
        return;
      }
    }

    setFields((current) =>
      current.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
    if (patch.key) setActiveKey(patch.key);
  }, [fields]);

  function deleteActiveField() {
    if (!activeField) return;
    setFields((current) => current.filter((field) => field.key !== activeField.key));
    setActiveKey(null);
  }

  function exportMapping() {
    downloadJson(
      createMapping(templateName, pdfFile?.name, fields),
      getMappingFileName(pdfFile?.name),
    );
  }

  async function exportFlattenedPdf() {
    if (!pdfFile) return;

    setIsFlattening(true);
    setError(null);

    try {
      const bytes = await flattenPdf(pdfFile);
      downloadBlob(
        new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
        getFlattenedPdfFileName(pdfFile.name),
      );
    } catch (caught) {
      setError(getPdfOutputError(caught));
    } finally {
      setIsFlattening(false);
    }
  }

  function useTemplateNow() {
    if (!pdfFile || !canExport) return;

    const mapping = createMapping(templateName, pdfFile.name, fields);
    onUseTemplate({
      pdfFile,
      mapping,
      mappingFileName: getMappingFileName(pdfFile.name),
    });
  }

  async function importMapping(file: File) {
    setError(null);
    setMappingFileName(file.name);

    try {
      const mapping = await readMappingFile(file);
      setTemplateName(mapping.templateName);
      setTemplatePdfName(mapping.templatePdfName);
      setTemplateMatch(
        getTemplateMatchResult(pdfFile?.name, mapping.templatePdfName, file.name),
      );
      setFields(mapping.fields);
      setActiveKey(mapping.fields[0]?.key ?? null);
      setPageNumber(mapping.fields[0]?.page ?? 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read template JSON.');
    }
  }

  return (
    <main className="page-shell">
      <section className="toolbar">
        <FilePicker
          id="builder-pdf"
          label="PDF"
          accept=".pdf,application/pdf"
          fileName={pdfFile?.name}
          onChange={handlePdfUpload}
        />
        <FilePicker
          id="builder-template-json"
          label="Import Template JSON"
          accept=".json,application/json"
          onChange={importMapping}
        />
        <label className="compact-input">
          Template Name
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.currentTarget.value)}
          />
        </label>
        <button type="button" onClick={addField} disabled={!pdfDocument}>
          Add Field
        </button>
        <button
          type="button"
          className={showDebug ? 'active' : ''}
          onClick={() => setShowDebug((current) => !current)}
          disabled={!pdfDocument}
        >
          Debug Coordinates
        </button>
        <button type="button" onClick={exportMapping} disabled={!canExport}>
          Export Template JSON
        </button>
        <button type="button" onClick={exportFlattenedPdf} disabled={!pdfFile || isFlattening}>
          {isFlattening ? 'Exporting Flattened PDF' : 'Export Flattened PDF'}
        </button>
        <button type="button" onClick={useTemplateNow} disabled={!canExport}>
          Use This Template Now
        </button>
      </section>

      {error && <p className="error-text">{error}</p>}
      {templateMatch && (
        <p className={templateMatch.kind === 'confirmed' ? 'success-text' : 'warning-text'}>
          {templateMatch.message}
        </p>
      )}

      <section className="workspace">
        <div className="pdf-pane">
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
                scale={RENDER_SCALE}
                onPageSize={setPageSize}
              />
              <FieldOverlay
                fields={fieldsForPage}
                activeKey={activeKey}
                scale={RENDER_SCALE}
                onSelect={setActiveKey}
                onChange={updateField}
              />
              {showDebug && (
                <CoordinateDebugOverlay
                  activeField={activeField}
                  pageHeight={pageSize.height}
                  pageWidth={pageSize.width}
                  scale={RENDER_SCALE}
                />
              )}
            </div>
          ) : (
            <div className="drop-placeholder">Upload a PDF to start mapping fields.</div>
          )}
        </div>

        <aside className="side-panel">
          <h2>Field Mapping</h2>
          <FieldEditor
            field={activeField}
            onChange={(patch) => activeField && updateField(activeField.key, patch)}
            onDelete={deleteActiveField}
          />
          <div className="field-list">
            <h3>Fields</h3>
            {fields.length === 0 ? (
              <p className="empty-state">No fields yet.</p>
            ) : (
              fields.map((field) => (
                <button
                  type="button"
                  key={`${field.page}-${field.key}`}
                  className={field.key === activeKey ? 'field-list-item selected' : 'field-list-item'}
                  onClick={() => {
                    setPageNumber(field.page);
                    setActiveKey(field.key);
                  }}
                >
                  <span>{field.label}</span>
                  <small>{field.key}</small>
                </button>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function getPdfOutputError(caught: unknown) {
  if (caught instanceof Error && caught.message) {
    return `Could not export flattened PDF. ${caught.message}`;
  }
  return 'Could not export flattened PDF.';
}

function makeUniqueKey(baseKey: string, fields: Field[]) {
  const existingKeys = new Set(fields.map((field) => field.key));
  if (!existingKeys.has(baseKey)) return baseKey;

  let suffix = 2;
  while (existingKeys.has(`${baseKey}_${suffix}`)) suffix += 1;
  return `${baseKey}_${suffix}`;
}
