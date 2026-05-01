type PasteValuesPanelProps = {
  value: string;
  warning: string | null;
  disabled: boolean;
  dynamicFieldCount: number;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
};

export function PasteValuesPanel({
  value,
  warning,
  disabled,
  dynamicFieldCount,
  onChange,
  onApply,
  onClear,
}: PasteValuesPanelProps) {
  return (
    <div className="paste-panel">
      <label>
        Paste Values — {dynamicFieldCount} dynamic field{dynamicFieldCount === 1 ? '' : 's'}
        <small className="field-hint">One line per dynamic field. Static fields are skipped.</small>
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
          Apply Lines
        </button>
        <button type="button" onClick={onClear}>
          Clear Values
        </button>
      </div>
    </div>
  );
}
