type PasteValuesPanelProps = {
  value: string;
  warning: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
};

export function PasteValuesPanel({
  value,
  warning,
  disabled,
  onChange,
  onApply,
  onClear,
}: PasteValuesPanelProps) {
  return (
    <div className="paste-panel">
      <label>
        Paste values in order
        <textarea
          value={value}
          rows={7}
          spellCheck={false}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </label>
      {warning && <p className="warning-text">{warning}</p>}
      <div className="inline-actions">
        <button type="button" onClick={onApply} disabled={disabled}>
          Apply Pasted Lines
        </button>
        <button type="button" onClick={onClear}>
          Clear Values
        </button>
      </div>
    </div>
  );
}
