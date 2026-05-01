import { memo } from 'react';
import { Rnd } from 'react-rnd';
import type { Field } from '../types/field';

type FieldOverlayProps = {
  fields: Field[];
  activeKey: string | null;
  fieldValues?: Record<string, string>;
  locked?: boolean;
  scale: number;
  suggestedKeys?: Set<string>;
  textOnly?: boolean;
  onSelect?: (key: string) => void;
  onDeselect?: () => void;
  onChange?: (key: string, patch: Partial<Field>) => void;
  onDuplicate?: (field: Field) => void;
  onDelete?: (key: string) => void;
};

function FieldOverlayComponent({
  fields,
  activeKey,
  fieldValues = {},
  locked = false,
  scale,
  suggestedKeys,
  textOnly = false,
  onSelect,
  onDeselect,
  onChange,
  onDuplicate,
  onDelete,
}: FieldOverlayProps) {
  return (
    <div
      className="field-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDeselect?.();
      }}
    >
      {fields.map((field) =>
        textOnly ? (
          <span
            key={field.key}
            className="static-preview-text"
            style={{
              left: field.x * scale,
              top: field.y * scale,
              width: field.width * scale,
              height: field.height * scale,
              fontSize: (field.fontSize ?? 12) * scale,
              lineHeight: 1.15,
            }}
          >
            {getPreviewText(field, fieldValues[field.key])}
          </span>
        ) : (
        <Rnd
          key={field.key}
          bounds="parent"
          className={getFieldClassName(
            field.key === activeKey,
            locked,
            suggestedKeys?.has(field.key) ?? false,
            field.type === 'static',
          )}
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
          onMouseDown={(event) => {
            event.stopPropagation();
            onSelect?.(field.key);
          }}
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
            <div
              className="field-inline-toolbar"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
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
                A−
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
                A+
              </button>
              <button
                type="button"
                className="toolbar-duplicate"
                aria-label="Duplicate field"
                onClick={() => onDuplicate?.(field)}
              >
                Duplicate
              </button>
              <details className="toolbar-more" onMouseDown={(event) => event.stopPropagation()}>
                <summary aria-label="More field options">⋯</summary>
                <div className="toolbar-menu">
                  <button
                    type="button"
                    onClick={() => onChange?.(field.key, { type: 'dynamic', staticText: undefined })}
                  >
                    Dynamic
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange?.(field.key, { type: 'static', staticText: field.staticText ?? '' })}
                  >
                    Static
                  </button>
                </div>
              </details>
              <button
                type="button"
                className="toolbar-delete"
                aria-label="Delete field"
                onClick={() => onDelete?.(field.key)}
              >
                Delete
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
        ),
      )}
    </div>
  );
}

function getPreviewText(field: Field, value: string | undefined) {
  if (field.type === 'static') return field.staticText?.trim() || field.label || 'Static text';
  if (value?.trim()) return value;
  if (field.label || field.key) return 'Sample text';
  return field.label || field.key;
}

function getFieldClassName(isActive: boolean, locked: boolean, isSuggested: boolean, isStatic: boolean) {
  return ['field-box', isStatic ? 'static' : '', isSuggested ? 'suggested' : '', isActive ? 'active' : '', locked ? 'locked' : '']
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
