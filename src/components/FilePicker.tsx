type FilePickerProps = {
  id: string;
  label: string;
  accept: string;
  fileName?: string;
  onChange: (file: File) => void;
};

export function FilePicker({
  id,
  label,
  accept,
  fileName,
  onChange,
}: FilePickerProps) {
  return (
    <label className="file-picker" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onChange(file);
          event.currentTarget.value = '';
        }}
      />
      <strong>{fileName ?? 'No file selected'}</strong>
    </label>
  );
}
