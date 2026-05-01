import type { Field } from '../types/field';

export type FieldSuggestion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Segment = {
  x: number;
  y: number;
  width: number;
};

const MAX_SUGGESTIONS = 12;
const MIN_LINE_LENGTH = 90;
const MIN_NATIVE_WIDTH = 70;
const DEFAULT_NATIVE_HEIGHT = 18;
const MIN_SPLIT_SEGMENT_WIDTH = 55;
const DEFAULT_FIELD_WIDTH_ESTIMATE = 138;

export function suggestFieldsFromCanvas(
  canvas: HTMLCanvasElement,
  scale: number,
  pageNumber: number,
  existingFields: Field[],
): FieldSuggestion[] {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || scale <= 0) return [];

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const mergedSegments = mergeNearbySegments(findHorizontalSegments(image));
  const suggestions: FieldSuggestion[] = [];

  for (const segment of splitWideSegments(image, mergedSegments, scale)) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (!hasMostlyBlankEntryArea(image, segment)) continue;

    const suggestion = {
      x: round(segment.x / scale),
      y: round(Math.max(0, segment.y / scale - DEFAULT_NATIVE_HEIGHT + 2)),
      width: round(segment.width / scale),
      height: DEFAULT_NATIVE_HEIGHT,
    };

    if (suggestion.width < MIN_NATIVE_WIDTH) continue;
    if (overlapsExisting(suggestion, pageNumber, existingFields)) continue;
    if (isDuplicateSuggestion(suggestion, suggestions)) continue;

    suggestions.push(suggestion);
  }

  return suggestions;
}

function findHorizontalSegments(image: ImageData) {
  const segments: Segment[] = [];
  const { width, height, data } = image;
  const allowedGap = 2;

  for (let y = 8; y < height - 8; y += 1) {
    let start = -1;
    let darkCount = 0;
    let gap = 0;

    for (let x = 8; x < width - 8; x += 1) {
      if (isInk(data, width, x, y)) {
        if (start === -1) start = x;
        darkCount += 1;
        gap = 0;
        continue;
      }

      if (start === -1) continue;

      gap += 1;
      if (gap <= allowedGap) continue;

      const end = x - gap;
      addSegmentIfUseful(segments, start, y, end - start, darkCount);
      start = -1;
      darkCount = 0;
      gap = 0;
    }

    if (start !== -1) {
      addSegmentIfUseful(segments, start, y, width - 8 - start, darkCount);
    }
  }

  return segments;
}

function addSegmentIfUseful(
  segments: Segment[],
  x: number,
  y: number,
  width: number,
  darkCount: number,
) {
  if (width < MIN_LINE_LENGTH) return;
  if (darkCount / width < 0.65) return;
  segments.push({ x, y, width });
}

function mergeNearbySegments(segments: Segment[]) {
  const merged: Segment[] = [];

  for (const segment of segments) {
    const existing = merged.find(
      (candidate) =>
        Math.abs(candidate.y - segment.y) <= 4 &&
        Math.abs(candidate.x - segment.x) <= 10 &&
        Math.abs(candidate.x + candidate.width - (segment.x + segment.width)) <= 10,
    );

    if (!existing) {
      merged.push({ ...segment });
      continue;
    }

    const left = Math.min(existing.x, segment.x);
    const right = Math.max(existing.x + existing.width, segment.x + segment.width);
    existing.x = left;
    existing.y = Math.round((existing.y + segment.y) / 2);
    existing.width = right - left;
  }

  return merged.sort((a, b) => a.y - b.y || a.x - b.x);
}

function splitWideSegments(image: ImageData, segments: Segment[], scale: number) {
  return segments.flatMap((segment) => {
    if (!shouldAttemptSplit(segment, scale)) return [segment];

    const candidateBox = getCandidateBox(segment, scale);
    const dividers = findInternalDividers(image, candidateBox);
    if (dividers.length === 0) return [segment];

    const splitSegments: Segment[] = [];
    let start = segment.x;
    for (const divider of dividers) {
      const width = divider - start;
      if (width >= MIN_SPLIT_SEGMENT_WIDTH) {
        splitSegments.push({ x: start, y: segment.y, width });
      }
      start = divider + 1;
    }

    const finalWidth = segment.x + segment.width - start;
    if (finalWidth >= MIN_SPLIT_SEGMENT_WIDTH) {
      splitSegments.push({ x: start, y: segment.y, width: finalWidth });
    }

    if (splitSegments.length <= 1) return [segment];
    if (splitSegments.some((splitSegment) => splitSegment.width < MIN_SPLIT_SEGMENT_WIDTH)) {
      return [segment];
    }

    return splitSegments;
  });
}

function shouldAttemptSplit(segment: Segment, scale: number) {
  const candidateHeight = DEFAULT_NATIVE_HEIGHT * scale;
  const likelyMultipleFields = segment.width > DEFAULT_FIELD_WIDTH_ESTIMATE * scale * 2.5;
  const veryWideComparedWithHeight = segment.width / Math.max(candidateHeight, 1) > 9;
  return likelyMultipleFields || veryWideComparedWithHeight;
}

function getCandidateBox(segment: Segment, scale: number) {
  const height = Math.max(16, DEFAULT_NATIVE_HEIGHT * scale);
  return {
    x: segment.x,
    y: Math.max(0, segment.y - height + 2),
    width: segment.width,
    height,
  };
}

function findInternalDividers(
  image: ImageData,
  candidateBox: { x: number; y: number; width: number; height: number },
) {
  const { width, height, data } = image;
  const top = Math.max(0, Math.round(candidateBox.y));
  const bottom = Math.min(height - 1, Math.round(candidateBox.y + candidateBox.height));
  const left = Math.max(0, Math.round(candidateBox.x));
  const right = Math.min(width - 1, Math.round(candidateBox.x + candidateBox.width));
  const edgeMargin = Math.max(18, Math.round(candidateBox.width * 0.08));
  const dividerColumns: number[] = [];

  if (bottom <= top || right - left < MIN_LINE_LENGTH) return [];

  for (let x = left + edgeMargin; x <= right - edgeMargin; x += 1) {
    const longestRun = getLongestVerticalInkRun(data, width, x, top, bottom);
    const spanRatio = longestRun / Math.max(1, bottom - top + 1);

    if (spanRatio >= 0.55) {
      dividerColumns.push(x);
    }
  }

  return collapseDividerBands(dividerColumns).filter((divider) => {
    const leftWidth = divider - left;
    const rightWidth = right - divider;
    return leftWidth >= MIN_SPLIT_SEGMENT_WIDTH && rightWidth >= MIN_SPLIT_SEGMENT_WIDTH;
  });
}

function getLongestVerticalInkRun(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  top: number,
  bottom: number,
) {
  let longestRun = 0;
  let currentRun = 0;

  for (let y = top; y <= bottom; y += 1) {
    if (isInk(data, width, x, y)) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
      continue;
    }

    currentRun = 0;
  }

  return longestRun;
}

function collapseDividerBands(dividerColumns: number[]) {
  const dividers: number[] = [];
  let bandStart = -1;
  let previous = -1;

  for (const x of dividerColumns) {
    if (bandStart === -1) {
      bandStart = x;
      previous = x;
      continue;
    }

    if (x - previous <= 2) {
      previous = x;
      continue;
    }

    dividers.push(Math.round((bandStart + previous) / 2));
    bandStart = x;
    previous = x;
  }

  if (bandStart !== -1) {
    dividers.push(Math.round((bandStart + previous) / 2));
  }

  return dividers.filter(
    (divider, index) => index === 0 || divider - dividers[index - 1] >= MIN_SPLIT_SEGMENT_WIDTH,
  );
}

function hasMostlyBlankEntryArea(image: ImageData, segment: Segment) {
  const { width, height, data } = image;
  const top = Math.max(0, segment.y - 28);
  const bottom = Math.max(0, segment.y - 4);
  const left = Math.max(0, segment.x + 6);
  const right = Math.min(width - 1, segment.x + segment.width - 6);

  if (bottom <= top || right <= left) return false;

  let inkCount = 0;
  let sampleCount = 0;
  for (let y = top; y <= Math.min(bottom, height - 1); y += 4) {
    for (let x = left; x <= right; x += 4) {
      sampleCount += 1;
      if (isInk(data, width, x, y)) inkCount += 1;
    }
  }

  return sampleCount > 0 && inkCount / sampleCount < 0.08;
}

function overlapsExisting(
  suggestion: FieldSuggestion,
  pageNumber: number,
  existingFields: Field[],
) {
  return existingFields.some((field) => {
    if (field.page !== pageNumber) return false;

    const overlapX = Math.max(
      0,
      Math.min(suggestion.x + suggestion.width, field.x + field.width) -
        Math.max(suggestion.x, field.x),
    );
    const overlapY = Math.max(
      0,
      Math.min(suggestion.y + suggestion.height, field.y + field.height) -
        Math.max(suggestion.y, field.y),
    );
    const overlapArea = overlapX * overlapY;
    const smallestArea = Math.min(
      suggestion.width * suggestion.height,
      field.width * field.height,
    );

    if (smallestArea > 0 && overlapArea / smallestArea > 0.15) return true;

    const sameHorizontalBand = Math.abs(suggestion.y - field.y) < 10;
    const horizontalOverlap =
      overlapX / Math.max(1, Math.min(suggestion.width, field.width));
    return sameHorizontalBand && horizontalOverlap > 0.6;
  });
}

function isDuplicateSuggestion(
  suggestion: FieldSuggestion,
  suggestions: FieldSuggestion[],
) {
  return suggestions.some((candidate) => {
    const overlapX = Math.max(
      0,
      Math.min(suggestion.x + suggestion.width, candidate.x + candidate.width) -
        Math.max(suggestion.x, candidate.x),
    );
    const horizontalOverlap =
      overlapX / Math.max(1, Math.min(suggestion.width, candidate.width));

    return Math.abs(suggestion.y - candidate.y) < 12 && horizontalOverlap > 0.6;
  });
}

function isInk(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (y * width + x) * 4;
  const alpha = data[index + 3];
  if (alpha < 32) return false;

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return red < 145 && green < 145 && blue < 145;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
