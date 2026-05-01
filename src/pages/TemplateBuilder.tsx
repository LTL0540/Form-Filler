import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoordinateDebugOverlay } from '../components/CoordinateDebugOverlay';
import { FieldEditor } from '../components/FieldEditor';
import { FieldOverlay } from '../components/FieldOverlay';
import { FilePicker } from '../components/FilePicker';
import { PdfPageCanvas } from '../components/PdfPageCanvas';
import { downloadBlob, downloadJson } from '../lib/download';
import { suggestFieldsFromCanvas } from '../lib/fieldSuggestions';
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
const DEFAULT_FIELD_WIDTH_PX = 180;
const DEFAULT_FIELD_HEIGHT_PX = 24;
const JUMP_LIST_LIMIT = 8;
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
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [suggestedFieldKeys, setSuggestedFieldKeys] = useState<Set<string>>(() => new Set());
  const [isJumpListOpen, setIsJumpListOpen] = useState(true);
  const [showAllJumpFields, setShowAllJumpFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfPaneRef = useRef<HTMLDivElement | null>(null);
  const pdfStageRef = useRef<HTMLDivElement | null>(null);
  const pdfToolbarRef = useRef<HTMLDivElement | null>(null);
  const renderedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedCanvasPageRef = useRef(0);
  const pendingScrollFieldRef = useRef<Field | null>(null);

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
  const hasMappingContext = !!pdfFile || !!mappingFileName || fields.length > 0;
  const mappingMismatchText =
    mappingMatch?.kind === 'warning'
      ? `Mapping references a different PDF: ${mappingPdfName ?? mappingFileName}`
      : null;
  const hasInvalidKeys = fields.some(
    (field, index) =>
      !field.key || fields.findIndex((candidate) => candidate.key === field.key) !== index,
  );
  const canExport = !!pdfFile && fields.length > 0 && !hasInvalidKeys;
  const visibleJumpFields = showAllJumpFields ? fields : fields.slice(0, JUMP_LIST_LIMIT);
  const previewScale = RENDER_SCALE * (zoomPercent / 100);
  const pageCount = pdfDocument?.numPages ?? 0;

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

  useEffect(() => {
    const field = pendingScrollFieldRef.current;
    if (!field || field.page !== pageNumber || !pageSize.width || !pageSize.height) return;

    window.requestAnimationFrame(() => {
      scrollPdfToField(field);
      pendingScrollFieldRef.current = null;
    });
  }, [pageNumber, pageSize.height, pageSize.width, previewScale]);

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
    const width = Math.round(DEFAULT_FIELD_WIDTH_PX / RENDER_SCALE);
    const height = Math.round(DEFAULT_FIELD_HEIGHT_PX / RENDER_SCALE);
    const position = getVisibleFieldPosition(width, height);
    const field: Field = {
      key,
      label: `Field ${nextIndex}`,
      type: 'text',
      page: pageNumber,
      x: position.x,
      y: position.y,
      width,
      height,
      order: nextIndex,
      fontSize: 12,
      lineHeight: 1.15,
    };

    onFieldsChange([...fields, field]);
    setActiveKey(field.key);
  }

  function suggestFields() {
    setError(null);
    setSuggestionMessage(null);

    if (!renderedCanvasRef.current || renderedCanvasPageRef.current !== pageNumber) {
      setSuggestionMessage('PDF page is still rendering. Try again in a moment.');
      return;
    }

    const suggestions = suggestFieldsFromCanvas(
      renderedCanvasRef.current,
      previewScale,
      pageNumber,
      fields,
    );

    if (suggestions.length === 0) {
      setSuggestionMessage('No obvious blank fields found on this page.');
      return;
    }

    const nextOrder = getNextOrder(fields);
    const suggestedFields: Field[] = [];

    for (const [index, suggestion] of suggestions.entries()) {
      const order = nextOrder + index;
      suggestedFields.push({
        key: makeUniqueKey(`field_${order}`, [...fields, ...suggestedFields]),
        label: `Suggested Field ${index + 1}`,
        type: 'text' as const,
        page: pageNumber,
        x: suggestion.x,
        y: suggestion.y,
        width: suggestion.width,
        height: suggestion.height,
        order,
        fontSize: 12,
        lineHeight: 1.15,
      });
    }

    onFieldsChange([...fields, ...suggestedFields]);
    setSuggestedFieldKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      for (const field of suggestedFields) nextKeys.add(field.key);
      return nextKeys;
    });
    setActiveKey(suggestedFields[0]?.key ?? null);
    setSuggestionMessage(
      `Added ${suggestedFields.length} suggested field${suggestedFields.length === 1 ? '' : 's'}. Review before saving.`,
    );
  }

  function getVisibleFieldPosition(width: number, height: number) {
    const fallbackPosition = {
      x: Math.round(24 / RENDER_SCALE),
      y: Math.round(24 / RENDER_SCALE),
    };

    if (!pdfPaneRef.current || !pdfStageRef.current) return fallbackPosition;

    const paneRect = pdfPaneRef.current.getBoundingClientRect();
    const stageRect = pdfStageRef.current.getBoundingClientRect();
    const toolbarBottom = pdfToolbarRef.current?.getBoundingClientRect().bottom ?? paneRect.top;
    const leftInStage = Math.max(0, paneRect.left - stageRect.left + 24);
    const topInStage = Math.max(0, toolbarBottom - stageRect.top + 16);
    const pageWidth = pageSize.width ? pageSize.width / previewScale : Number.POSITIVE_INFINITY;
    const pageHeight = pageSize.height ? pageSize.height / previewScale : Number.POSITIVE_INFINITY;

    return {
      x: round(Math.min(leftInStage / previewScale, Math.max(0, pageWidth - width))),
      y: round(Math.min(topInStage / previewScale, Math.max(0, pageHeight - height))),
    };
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

  function jumpToField(field: Field) {
    pendingScrollFieldRef.current = field;
    setPageNumber(field.page);
    setActiveKey(field.key);

    if (field.page === pageNumber) {
      window.requestAnimationFrame(() => {
        scrollPdfToField(field);
        pendingScrollFieldRef.current = null;
      });
    }
  }

  function scrollPdfToField(field: Field) {
    if (!pdfStageRef.current) return;

    const toolbarHeight = pdfToolbarRef.current?.offsetHeight ?? 0;
    const stageRect = pdfStageRef.current.getBoundingClientRect();
    const top =
      window.scrollY +
      stageRect.top +
      field.y * previewScale -
      toolbarHeight -
      40;
    const left = window.scrollX + stageRect.left + field.x * previewScale - 40;

    window.scrollTo({
      top: Math.max(0, top),
      left: Math.max(0, left),
      behavior: 'smooth',
    });
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
    setSuggestedFieldKeys((currentKeys) => {
      if (!currentKeys.has(key)) return currentKeys;
      const nextKeys = new Set(currentKeys);
      nextKeys.delete(key);
      return nextKeys;
    });
    if (patch.key) setActiveKey(patch.key);
  }, [fields, onFieldsChange]);

  const handleCanvasRendered = useCallback((canvas: HTMLCanvasElement) => {
    renderedCanvasRef.current = canvas;
    renderedCanvasPageRef.current = pageNumber;
  }, [pageNumber]);

  function deleteActiveField() {
    if (!activeField) return;
    onFieldsChange(fields.filter((field) => field.key !== activeField.key));
    setSuggestedFieldKeys((currentKeys) => removeKeys(currentKeys, [activeField.key]));
    setActiveKey(null);
  }

  function deleteField(key: string) {
    onFieldsChange(fields.filter((field) => field.key !== key));
    setSuggestedFieldKeys((currentKeys) => removeKeys(currentKeys, [key]));
    if (activeKey === key) setActiveKey(null);
  }

  function clearSuggestedFields() {
    if (suggestedFieldKeys.size === 0) return;

    onFieldsChange(fields.filter((field) => !suggestedFieldKeys.has(field.key)));
    if (activeKey && suggestedFieldKeys.has(activeKey)) setActiveKey(null);
    setSuggestedFieldKeys(new Set());
    setSuggestionMessage('Cleared suggested fields.');
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
      setSuggestedFieldKeys(new Set());
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
        <div className="upload-control">
          <FilePicker
            id="builder-template-json"
            label="Load Mapping File"
            accept=".json,application/json"
            fileName={mappingFileName}
            onChange={importMapping}
          />
          {mappingMismatchText && <p className="upload-warning">{mappingMismatchText}</p>}
        </div>
        <div className="toolbar-save-actions">
          <button type="button" className="primary-action" onClick={exportMapping} disabled={!canExport}>
            Save Form Mapping
          </button>
          <p>Saves layout only. Entered values are not included.</p>
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
      {suggestionMessage && <p className="template-status">{suggestionMessage}</p>}
      {hasMappingContext && (
        <p className={layoutStatus === 'unsaved' ? 'warning-text' : 'success-text'}>
          Form Mapping • {layoutStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}
        </p>
      )}

      <section className="workspace builder-workspace">
        <aside className="side-panel">
          <div className="mapping-panel-top">
            <h2>Form Mapping</h2>
            <FieldEditor
              field={activeField}
              onChange={(patch) => activeField && updateField(activeField.key, patch)}
              onDelete={deleteActiveField}
            />
          </div>
          <hr className="panel-separator" />
          <div className="field-list">
            <button
              type="button"
              className="field-list-toggle"
              onClick={() => setIsJumpListOpen((isOpen) => !isOpen)}
            >
              <span>Jump to Field ({fields.length})</span>
              <small>{isJumpListOpen ? 'Hide' : 'Show'}</small>
            </button>
            {isJumpListOpen && (
              <>
                {fields.length === 0 ? (
                  <p className="empty-state">No fields yet.</p>
                ) : (
                  <div className="field-list-items">
                    {visibleJumpFields.map((field) => (
                      <div
                        key={`${field.page}-${field.key}`}
                        className={field.key === activeKey ? 'field-list-row selected' : 'field-list-row'}
                      >
                        <button
                          type="button"
                          className="field-list-item"
                          onClick={() => jumpToField(field)}
                        >
                          <span>{field.label}</span>
                          <small>Page {field.page} · Order {field.order ?? '-'}</small>
                        </button>
                        <button
                          type="button"
                          className="field-list-delete"
                          aria-label={`Delete ${field.label}`}
                          onClick={() => deleteField(field.key)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {fields.length > JUMP_LIST_LIMIT && (
                      <button
                        type="button"
                        className="field-list-more"
                        onClick={() => setShowAllJumpFields((isShowingAll) => !isShowingAll)}
                      >
                        {showAllJumpFields ? 'Show fewer' : `Show all ${fields.length}`}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <section className="advanced-panel">
            <h3>Advanced</h3>
            <button
              type="button"
              className="secondary-action"
              onClick={suggestFields}
              disabled={!pdfDocument}
            >
              Suggest Fields (beta)
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={clearSuggestedFields}
              disabled={suggestedFieldKeys.size === 0}
            >
              Clear Suggested Fields
            </button>
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

        <div className="pdf-pane" ref={pdfPaneRef}>
          <div className="pdf-pane-header" ref={pdfToolbarRef}>
            <div className="pdf-toolbar-left">
              <button
                type="button"
                onClick={() => setPageNumber((current) => current - 1)}
                disabled={!pdfDocument || pageNumber <= 1}
              >
                Previous
              </button>
            </div>
            <div className="pdf-toolbar-center">
              <span className="page-indicator">
                {pageCount > 0 ? `Page ${pageNumber} of ${pageCount}` : 'Page -'}
              </span>
              <button
                type="button"
                onClick={() => setPageNumber((current) => current + 1)}
                disabled={!pdfDocument || pageNumber >= pageCount}
              >
                Next
              </button>
              <button type="button" className="add-field-action" onClick={addField} disabled={!pdfDocument}>
                Add Field
              </button>
            </div>
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
              ref={pdfStageRef}
              style={{ width: pageSize.width, minHeight: pageSize.height }}
            >
              <PdfPageCanvas
                pdfDocument={pdfDocument}
                pageNumber={pageNumber}
                scale={previewScale}
                onPageSize={setPageSize}
                onCanvasRendered={handleCanvasRendered}
              />
              <FieldOverlay
                fields={fieldsForPage}
                activeKey={activeKey}
                fieldValues={values}
                scale={previewScale}
                suggestedKeys={suggestedFieldKeys}
                onSelect={setActiveKey}
                onDeselect={() => setActiveKey(null)}
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

function removeKeys(keys: Set<string>, removedKeys: string[]) {
  if (removedKeys.every((key) => !keys.has(key))) return keys;

  const nextKeys = new Set(keys);
  for (const key of removedKeys) nextKeys.delete(key);
  return nextKeys;
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
