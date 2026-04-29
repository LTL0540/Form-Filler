import { memo } from 'react';
import { Rnd } from 'react-rnd';
import type { Field } from '../types/field';

type FieldOverlayProps = {
  fields: Field[];
  activeKey: string | null;
  scale: number;
  onSelect: (key: string) => void;
  onChange: (key: string, patch: Partial<Field>) => void;
};

function FieldOverlayComponent({
  fields,
  activeKey,
  scale,
  onSelect,
  onChange,
}: FieldOverlayProps) {
  return (
    <div className="field-overlay">
      {fields.map((field) => (
        <Rnd
          key={field.key}
          bounds="parent"
          className={field.key === activeKey ? 'field-box active' : 'field-box'}
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
          onMouseDown={() => onSelect(field.key)}
          onDragStop={(_, data) => {
            onChange(field.key, {
              x: round(data.x / scale),
              y: round(data.y / scale),
            });
          }}
          onResizeStop={(_, __, ref, ___, position) => {
            onChange(field.key, {
              x: round(position.x / scale),
              y: round(position.y / scale),
              width: round(ref.offsetWidth / scale),
              height: round(ref.offsetHeight / scale),
            });
          }}
        >
          <span>{field.label || field.key}</span>
        </Rnd>
      ))}
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export const FieldOverlay = memo(FieldOverlayComponent);
