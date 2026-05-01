import { useState } from 'react';
import { getTemplateMatchResult } from './lib/templateNames';
import { FormFiller } from './pages/FormFiller';
import { TemplateBuilder } from './pages/TemplateBuilder';
import type { Field } from './types/field';

type Mode = 'builder' | 'filler';

export default function App() {
  const [mode, setMode] = useState<Mode>('builder');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mappingName, setMappingName] = useState('Untitled Form Mapping');
  const [mappingPdfName, setMappingPdfName] = useState<string | undefined>();
  const [mappingFileName, setMappingFileName] = useState<string | undefined>();
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState('');
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);
  const [hasUnsavedLayoutChanges, setHasUnsavedLayoutChanges] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  function clearSession() {
    if (
      !window.confirm(
        'Clear the current PDF, field layout, pasted text, and entered values from this browser session?',
      )
    ) {
      return;
    }

    setPdfFile(null);
    setMappingName('Untitled Form Mapping');
    setMappingPdfName(undefined);
    setMappingFileName(undefined);
    setFields([]);
    setValues({});
    setPasteText('');
    setPasteWarning(null);
    setHasUnsavedLayoutChanges(false);
    setSessionVersion((version) => version + 1);
  }

  function updatePdfFile(nextFile: File | null) {
    if (!nextFile) {
      setPdfFile(null);
      return;
    }

    const matchResult =
      mappingFileName && mappingPdfName
        ? getTemplateMatchResult(nextFile.name, mappingPdfName, mappingFileName)
        : null;

    if (matchResult?.kind === 'warning') {
      setValues({});
      setPasteText('');
      setPasteWarning(null);
    }

    setPdfFile(nextFile);
  }

  function updateFields(nextFields: Field[]) {
    setFields(nextFields);
    setHasUnsavedLayoutChanges(true);
  }

  function updateMappingName(nextName: string) {
    setMappingName(nextName);
    setHasUnsavedLayoutChanges(true);
  }

  function updateMappingFileName(nextName: string | undefined) {
    setMappingFileName(nextName);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>FormONE</h1>
          <p>Map → Fill → Print</p>
          <small>Set it up once. Fill it anytime. Stays local.</small>
        </div>
        <div className="header-actions">
          <nav className="mode-toggle" aria-label="Mode">
            <button
              type="button"
              className={mode === 'builder' ? 'active' : ''}
              onClick={() => setMode('builder')}
            >
              Form Setup
            </button>
            <button
              type="button"
              className={mode === 'filler' ? 'active' : ''}
              onClick={() => setMode('filler')}
            >
              Form Filler
            </button>
          </nav>
          <div className="header-side-actions">
            <button type="button" className="help-button" onClick={() => setIsHelpOpen(true)}>
              Help
            </button>
            <button type="button" className="danger" onClick={clearSession}>
              Clear Session
            </button>
          </div>
        </div>
      </header>

      {isHelpOpen && (
        <div className="help-backdrop" role="presentation" onClick={() => setIsHelpOpen(false)}>
          <section
            className="help-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-panel-header">
              <h2 id="help-title">How to use FormONE</h2>
              <button type="button" className="help-close" onClick={() => setIsHelpOpen(false)} aria-label="Close help">
                ×
              </button>
            </div>
            <div className="help-section">
              <h3>Set up a form</h3>
              <ol>
                <li>Go to Form Setup.</li>
                <li>Upload the blank PDF.</li>
                <li>Click Add Field.</li>
                <li>Drag and resize boxes over the form fields.</li>
                <li>Save Form Mapping.</li>
              </ol>
              <p>You only need to set up each form once.</p>
            </div>
            <div className="help-section">
              <h3>Fill a form</h3>
              <ol>
                <li>Go to Form Filler.</li>
                <li>Upload the PDF and Load Mapping File, or continue from the current setup.</li>
                <li>Paste values in order, one line per field.</li>
                <li>Review the preview.</li>
                <li>Click Print Completed Form.</li>
              </ol>
            </div>
            <div className="help-section">
              <h3>Static fields</h3>
              <p>Use static fields for text that is always the same, such as clinic name, phone/fax number, address, prescriber name, or standard wording.</p>
              <p>Do not use static fields for patient-specific or confidential information.</p>
              <p>Static fields are saved in the form mapping file. Dynamic fields are filled later from pasted or typed values.</p>
            </div>
            <div className="help-section">
              <h3>Tips</h3>
              <ul>
                <li>Click a field to edit it.</li>
                <li>Click outside a field to deselect it.</li>
                <li>Use Duplicate to copy field size and style.</li>
                <li>Use Jump to Field to find fields.</li>
                <li>Save Form Mapping saves layout only. Entered values are not included.</li>
                <li>Always review the completed PDF before use.</li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {mode === 'builder' ? (
        <TemplateBuilder
          key={`builder-${sessionVersion}`}
          pdfFile={pdfFile}
          mappingName={mappingName}
          mappingPdfName={mappingPdfName}
          mappingFileName={mappingFileName}
          fields={fields}
          values={values}
          onPdfFileChange={updatePdfFile}
          layoutStatus={hasUnsavedLayoutChanges ? 'unsaved' : 'saved'}
          onMappingNameChange={updateMappingName}
          onMappingPdfNameChange={setMappingPdfName}
          onMappingFileNameChange={updateMappingFileName}
          onFieldsChange={updateFields}
          onLayoutSaved={() => setHasUnsavedLayoutChanges(false)}
        />
      ) : (
        <FormFiller
          key={`filler-${sessionVersion}`}
          pdfFile={pdfFile}
          mappingPdfName={mappingPdfName}
          mappingFileName={mappingFileName}
          fields={fields}
          values={values}
          pasteText={pasteText}
          pasteWarning={pasteWarning}
          layoutStatus={hasUnsavedLayoutChanges ? 'unsaved' : 'saved'}
          onPdfFileChange={updatePdfFile}
          onMappingNameChange={setMappingName}
          onMappingPdfNameChange={setMappingPdfName}
          onMappingFileNameChange={updateMappingFileName}
          onFieldsChange={setFields}
          onValuesChange={setValues}
          onPasteTextChange={setPasteText}
          onPasteWarningChange={setPasteWarning}
          onLayoutSaved={() => setHasUnsavedLayoutChanges(false)}
        />
      )}
      <footer className="app-footer">
        <p>Runs entirely in your browser. No data is sent or stored by this app.</p>
        <p>Use only on secure, approved devices and networks.</p>
        <p>Verify outputs before use.</p>
        <p>Source code licensed for noncommercial use under the <a href="https://polyformproject.org/licenses/noncommercial/1.0.0/" target="_blank" rel="noreferrer">PolyForm Noncommercial License 1.0.0</a>.</p>
      </footer>
    </div>
  );
}
