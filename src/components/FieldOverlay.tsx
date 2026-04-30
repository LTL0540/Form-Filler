import { memo } from 'react';
import { Rnd } from 'react-rnd';
import type { Field } from '../types/field';

type FieldOverlayProps = {
  fields: Field[];
  activeKey: string | null;
  fieldValues?: Record<string, string>;
  locked?: boolean;
  scale: number;
  onSelect?: (key: string) => void;
  onChange?: (key: string, patch: Partial<Field>) => void;
  onDelete?: (key: string) => void;
};

function FieldOverlayComponent({
  fields,
  activeKey,
  fieldValues = {},
  locked = false,
  scale,
  onSelect,
  onChange,
  onDelete,
}: FieldOverlayProps) {
  return (
    <div className="field-overlay">
      {fields.map((field) => (
        <Rnd
          key={field.key}
          bounds="parent"
          className={getFieldClassName(field.key === activeKey, locked)}
          size={{
            width: field.width * scale,
            height: field.height * scale,
          }}
          position={{
            x: field.x * scale,
            y: field.y * scale,
          }}
          minWidth={32}
          minHeight={20}
          disableDragging={locked}
          enableResizing={!locked}
          onMouseDown={() => onSelect?.(field.key)}
          onDragStop={(_, data) => {
            if (locked || !onChange) return;
            onChange(field.key, {
              x: round(data.x / scale),
              y: round(data.y / scale),
            });
          }}
          onResizeStop={(_, __, ref, ___, position) => {
            if (locked || !onChange) return;
            onChange(field.key, {
              x: round(position.x / scale),
              y: round(position.y / scale),
              width: round(ref.offsetWidth / scale),
              height: round(ref.offsetHeight / scale),
            });
          }}
        >
          {!locked && field.key === activeKey && (
            <div className="field-inline-toolbar" onMouseDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="font-smaller"
                aria-label="Smaller font"
                onClick={() =>
                  onChange?.(field.key, {
                    fontSize: Math.max(6, (field.fontSize ?? 12) - getFontStep(field.fontSize ?? 12)),
                  })
                }
              >
                A
              </button>
              <button
                type="button"
                className="font-larger"
                aria-label="Larger font"
                onClick={() =>
                  onChange?.(field.key, {
                    fontSize: Math.min(72, (field.fontSize ?? 12) + getFontStep(field.fontSize ?? 12)),
                  })
                }
              >
                A
              </button>
              <button
                type="button"
                className="toolbar-delete"
                aria-label="Delete field"
                onClick={() => onDelete?.(field.key)}
              >
                ×
              </button>
            </div>
          )}
          <span
            className="field-box-text"
            style={{
              fontSize: (field.fontSize ?? 12) * scale,
              lineHeight: 1.15,
            }}
          >
            {getPreviewText(field, fieldValues[field.key])}
          </span>
        </Rnd>
      ))}
    </div>
  );
}

function getPreviewText(field: Field, value: string | undefined) {
  if (value?.trim()) return value;
  if (field.label || field.key) return 'Sample text';
  return field.label || field.key;
}

function getFieldClassName(isActive: boolean, locked: boolean) {
  return ['field-box', isActive ? 'active' : '', locked ? 'locked' : '']
    .filter(Boolean)
    .join(' ');
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function getFontStep(fontSize: number) {
  if (fontSize < 12) return 1;
  if (fontSize <= 24) return 2;
  return 4;
}

export const FieldOverlay = memo(FieldOverlayComponent);
