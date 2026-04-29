import type { Field } from '../types/field';

type CoordinateDebugOverlayProps = {
  activeField: Field | null;
  pageHeight: number;
  pageWidth: number;
  scale: number;
};

export function CoordinateDebugOverlay({
  activeField,
  pageHeight,
  pageWidth,
  scale,
}: CoordinateDebugOverlayProps) {
  const horizontalTicks = makeTicks(pageHeight / scale);
  const verticalTicks = makeTicks(pageWidth / scale);

  return (
    <div className="coordinate-debug" aria-hidden="true">
      {verticalTicks.map((x) => (
        <span
          key={`x-${x}`}
          className="debug-line vertical"
          style={{ left: x * scale }}
        >
          {x}
        </span>
      ))}
      {horizontalTicks.map((y) => (
        <span
          key={`y-${y}`}
          className="debug-line horizontal"
          style={{ top: y * scale }}
        >
          {y}
        </span>
      ))}
      <div className="debug-readout">
        <strong>Preview scale {scale}</strong>
        {activeField ? (
          <span>
            {activeField.key}: p{activeField.page}, x {activeField.x}, y {activeField.y}, w{' '}
            {activeField.width}, h {activeField.height}
          </span>
        ) : (
          <span>Select a field to inspect coordinates.</span>
        )}
      </div>
    </div>
  );
}

function makeTicks(max: number) {
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += 50) {
    ticks.push(value);
  }
  return ticks;
}
