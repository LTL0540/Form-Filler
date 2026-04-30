import { useCallback, useEffect, useMemo, useState } from 'react';
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

const RENDER_SCALE = 1.3;
const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200];

type TemplateBuilderProps = {
  pdfFile: File | null;
  mappingName: string;
  mappingPdfName: string | undefined;
  mappingFileName: string | undefined;
  fields: Field[];
  values: Record<string, string>;
  layoutStatus: 'saved' | 'unsaved';
  onPdfFileChange: (file: File | null) => void;
  onMappingNameChange: (name: string) => void;
  onMappingPdfNameChange: (name: string | undefined) => void;
  onMappingFileNameChange: (name: string | undefined) => void;
  onFieldsChange: (fields: Field[]) => void;
  onLayoutSaved: () => void;
};

export function TemplateBuilder({
  pdfFile,
  mappingName,
  mappingPdfName,
  mappingFileName,
  fields,
  values,
  layoutStatus,
  onPdfFileChange,
  onMappingNameChange,
  onMappingPdfNameChange,
  onMappingFileNameChange,
  onFieldsChange,
  onLayoutSaved,
}: TemplateBuilderProps) {
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFlattening, setIsFlattening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldsForPage = useMemo(
    () => fields.filter((field) => field.page === pageNumber),
    [fields, pageNumber],
  );
  const activeField = fields.find((field) => field.key === activeKey) ?? null;
  const mappingMatch: TemplateMatchResult | null = useMemo(
    () =>
      mappingFileName && mappingPdfName
        ? getTemplateMatchResult(pdfFile?.name, mappingPdfName, mappingFileName)
        : null,
    [mappingFileName, mappingPdfName, pdfFile?.name],
  );
  const hasInvalidKeys = fields.some(
    (field, index) =>
      !field.key || fields.findIndex((candidate) => candidate.key === field.key) !== index,
  );
  const canExport = !!pdfFile && fields.length > 0 && !hasInvalidKeys;
  const previewScale = RENDER_SCALE * (zoomPercent / 100);

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

  useEffect(() => {
    function deleteSelectedField(event: KeyboardEvent) {
      if (!activeKey || !isDeleteKey(event) || isTypingTarget(event.target)) return;

      event.preventDefault();
      onFieldsChange(fields.filter((field) => field.key !== activeKey));
      setActiveKey(null);
    }

    window.addEventListener('keydown', deleteSelectedField);
    return () => window.removeEventListener('keydown', deleteSelectedField);
  }, [activeKey, fields, onFieldsChange]);

  async function handlePdfUpload(file: File) {
    setError(null);
    onPdfFileChange(file);
    if (fields.length === 0) {
      onMappingNameChange(file.name.replace(/\.pdf$/i, '') || 'Untitled Form Mapping');
    }
    setPageNumber(1);
  }

  function addField() {
    const nextIndex = getNextOrder(fields);
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
      fontSize: 12,
      lineHeight: 1.15,
    };

    onFieldsChange([...fields, field]);
    setActiveKey(field.key);
  }

  function duplicateField(sourceField: Field) {
    const nextOrder = getNextOrder(fields);
    const key = makeUniqueKey(`field_${nextOrder}`, fields);
    const offset = 12;
    const pageWidth = pageSize.width ? pageSize.width / previewScale : Number.POSITIVE_INFINITY;
    const pageHeight = pageSize.height ? pageSize.height / previewScale : Number.POSITIVE_INFINITY;
    const clonedField: Field = {
      ...sourceField,
      key,
      label: `Field ${nextOrder}`,
      x: round(Math.min(sourceField.x + offset, Math.max(0, pageWidth - sourceField.width))),
      y: round(Math.min(sourceField.y + offset, Math.max(0, pageHeight - sourceField.height))),
      order: nextOrder,
    };

    onFieldsChange([...fields, clonedField]);
    setPageNumber(clonedField.page);
    setActiveKey(clonedField.key);
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

    onFieldsChange(
      fields.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
    if (patch.key) setActiveKey(patch.key);
  }, [fields, onFieldsChange]);

  function deleteActiveField() {
    if (!activeField) return;
    onFieldsChange(fields.filter((field) => field.key !== activeField.key));
    setActiveKey(null);
  }

  function deleteField(key: string) {
    onFieldsChange(fields.filter((field) => field.key !== key));
    if (activeKey === key) setActiveKey(null);
  }

  function exportMapping() {
    downloadJson(
      createMapping(mappingName, pdfFile?.name, fields),
      getMappingFileName(pdfFile?.name),
    );
    onLayoutSaved();
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

  async function importMapping(file: File) {
    setError(null);
    onMappingFileNameChange(file.name);

    try {
      const mapping = await readMappingFile(file);
      onMappingNameChange(mapping.templateName);
      onMappingPdfNameChange(mapping.templatePdfName);
      onFieldsChange(mapping.fields);
      onLayoutSaved();
      setActiveKey(mapping.fields[0]?.key ?? null);
      setPageNumber(mapping.fields[0]?.page ?? 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read Mapping File.');
    }
  }

  return (
    <main className="page-shell">
      <section className="toolbar">
        <div className="upload-control">
          <FilePicker
            id="builder-pdf"
            label="Upload PDF to be Mapped"
            accept=".pdf,application/pdf"
            fileName={pdfFile?.name}
            onChange={handlePdfUpload}
          />
          <p className="upload-note">Upload PDF only. Word documents should be saved as PDF before use.</p>
        </div>
        <FilePicker
          id="builder-template-json"
          label="Load Mapping File"
          accept=".json,application/json"
          fileName={mappingFileName}
          onChange={importMapping}
        />
        <div className="toolbar-save-actions">
          <button type="button" className="primary-action" onClick={exportMapping} disabled={!canExport}>
            Save Form Mapping
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={exportFlattenedPdf}
            disabled={!pdfFile || isFlattening}
          >
            {isFlattening ? 'Saving Cleaned PDF' : 'Save Cleaned PDF (optional)'}
          </button>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}
      <p className={layoutStatus === 'unsaved' ? 'warning-text' : 'success-text'}>
        Form Mapping: {layoutStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}
      </p>
      {mappingMatch && (
        <p className={mappingMatch.kind === 'confirmed' ? 'success-text' : 'warning-text'}>
          {mappingMatch.message}
        </p>
      )}

      <section className="workspace builder-workspace">
        <aside className="side-panel">
          <h2>Form Mapping</h2>
          <button type="button" className="add-field-action" onClick={addField} disabled={!pdfDocument}>
            Add Field
          </button>
          <FieldEditor
            field={activeField}
            onChange={(patch) => activeField && updateField(activeField.key, patch)}
            onDelete={deleteActiveField}
          />
          <hr className="panel-separator" />
          <div className="field-list">
            <h3>Jump to Field</h3>
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
                  <small>Order {field.order ?? '-'}</small>
                </button>
              ))
            )}
          </div>
          <section className="advanced-panel">
            <h3>Advanced</h3>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showDebug}
                disabled={!pdfDocument}
                onChange={(event) => setShowDebug(event.currentTarget.checked)}
              />
              Show Grid
            </label>
          </section>
        </aside>

        <div className="pdf-pane">
          <div className="pdf-pane-header">
            <PageControls
              pageNumber={pageNumber}
              pageCount={pdfDocument?.numPages ?? 0}
              onPageChange={setPageNumber}
            />
            <div className="zoom-controls" aria-label="PDF zoom controls">
              <button
                type="button"
                onClick={() => setZoomPercent((current) => Math.max(50, current - 25))}
                disabled={zoomPercent <= 50}
              >
                −
              </button>
              <select
                value={zoomPercent}
                onChange={(event) => setZoomPercent(Number(event.currentTarget.value))}
                aria-label="Current zoom"
              >
                {ZOOM_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}%
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setZoomPercent((current) => Math.min(200, current + 25))}
                disabled={zoomPercent >= 200}
              >
                +
              </button>
            </div>
          </div>
          {pdfDocument ? (
            <div
              className="pdf-stage"
              style={{ width: pageSize.width, minHeight: pageSize.height }}
            >
              <PdfPageCanvas
                pdfDocument={pdfDocument}
                pageNumber={pageNumber}
                scale={previewScale}
                onPageSize={setPageSize}
              />
              <FieldOverlay
                fields={fieldsForPage}
                activeKey={activeKey}
                fieldValues={values}
                scale={previewScale}
                onSelect={setActiveKey}
                onChange={updateField}
                onDuplicate={duplicateField}
                onDelete={deleteField}
              />
              {showDebug && (
                <CoordinateDebugOverlay
                  activeField={activeField}
                  pageHeight={pageSize.height}
                  pageWidth={pageSize.width}
                  scale={previewScale}
                />
              )}
            </div>
          ) : (
            <div className="drop-placeholder">Upload a PDF to start mapping fields.</div>
          )}
        </div>
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

function getNextOrder(fields: Field[]) {
  const highestOrder = fields.reduce(
    (highest, field, index) => Math.max(highest, field.order ?? index + 1),
    0,
  );
  return highestOrder + 1;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isDeleteKey(event: KeyboardEvent) {
  return event.key === 'Delete' || event.key === 'Backspace';
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}
