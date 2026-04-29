import { useState } from 'react';
import { FormFiller } from './pages/FormFiller';
import { TemplateBuilder } from './pages/TemplateBuilder';
import type { TemplatePackage } from './types/template';

type Mode = 'builder' | 'filler';

export default function App() {
  const [mode, setMode] = useState<Mode>('builder');
  const [activeTemplate, setActiveTemplate] = useState<TemplatePackage | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>PDF Form Filler</h1>
          <p>Browser-only template builder and form filling workflow.</p>
        </div>
        <nav aria-label="Mode">
          <button
            type="button"
            className={mode === 'builder' ? 'active' : ''}
            onClick={() => setMode('builder')}
          >
            Template Builder
          </button>
          <button
            type="button"
            className={mode === 'filler' ? 'active' : ''}
            onClick={() => setMode('filler')}
          >
            Form Filler
          </button>
        </nav>
      </header>

      {mode === 'builder' ? (
        <TemplateBuilder
          onUseTemplate={(templatePackage) => {
            setActiveTemplate(templatePackage);
            setMode('filler');
          }}
        />
      ) : (
        <FormFiller initialTemplate={activeTemplate} />
      )}
    </div>
  );
}
