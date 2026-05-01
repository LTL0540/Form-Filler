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
          <button type="button" className="danger" onClick={clearSession}>
            Clear Session
          </button>
        </div>
      </header>

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
