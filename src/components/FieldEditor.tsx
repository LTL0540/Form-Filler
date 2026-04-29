import type { Field } from '../types/field';

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

  return (
    <div className="field-editor">
      <label>
        Field Number
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
        Title
        <input
          value={field.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </label>
      <button type="button" className="danger" onClick={onDelete}>
        Delete Field
      </button>
    </div>
  );
}
