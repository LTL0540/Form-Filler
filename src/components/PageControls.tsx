type PageControlsProps = {
  pageNumber: number;
  pageCount: number;
  onPageChange: (pageNumber: number) => void;
};

export function PageControls({
  pageNumber,
  pageCount,
  onPageChange,
}: PageControlsProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="page-controls" aria-label="PDF page controls">
      <button
        type="button"
        onClick={() => onPageChange(pageNumber - 1)}
        disabled={pageNumber <= 1}
      >
        Previous
      </button>
      <span>
        Page {pageNumber} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(pageNumber + 1)}
        disabled={pageNumber >= pageCount}
      >
        Next
      </button>
    </div>
  );
}
