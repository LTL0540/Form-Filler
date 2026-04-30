import type { Field } from '../types/field';

const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

type FieldEditorProps = {
  field: Field | null;
  onChange: (patch: Partial<Field>) => void;
  onDelete: () => void;
};

export function FieldEditor({
  field,
  onChange,
  onDelete,
}: FieldEditorProps) {
  if (!field) {
    return <p className="empty-state">Select a field box to edit its mapping.</p>;
  }

  const fontSizeOptions = getFontSizeOptions(field.fontSize ?? 12);

  return (
    <div className="field-editor">
      <label>
        Order
        <input
          type="number"
          min={1}
          value={field.order ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value;
            onChange({ order: value === '' ? undefined : Number(value) });
          }}
        />
      </label>
      <label>
        Label
        <input
          value={field.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </label>
      <label>
        Font size
        <select
          value={field.fontSize ?? 12}
          onChange={(event) => onChange({ fontSize: Number(event.currentTarget.value) })}
        >
          {fontSizeOptions.map((fontSize) => (
            <option key={fontSize} value={fontSize}>
              {fontSize}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="danger" onClick={onDelete}>
        Delete Field
      </button>
    </div>
  );
}

function getFontSizeOptions(currentFontSize: number) {
  return Array.from(new Set([...FONT_SIZE_OPTIONS, currentFontSize])).sort((a, b) => a - b);
}
