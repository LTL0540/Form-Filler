# FormONE

Map → Fill → Print

Set it up once. Fill it anytime. Stays local.

FormONE is a browser-based tool for mapping and filling PDF/static forms locally. It lets users map fields on a PDF once, save the form mapping, then paste or enter new values to generate a completed PDF.

## What it does

- Upload a PDF form
- Map fields visually
- Save a reusable form mapping file
- Load a PDF + mapping file later
- Paste values in order
- Preview filled fields
- Print/download the completed form

## Privacy model

FormONE runs entirely in the browser.

- No backend
- No server calls
- No database
- No account
- No data sent or stored by the app
- Form values are kept only in browser memory during the session

Form mapping files may store non-PHI layout metadata such as field labels, order, coordinates, font size, and PDF filename. Do not store patient details or confidential information in mapping names or field labels.

## Important use notes

Use only on secure, approved devices and networks.

Verify all outputs before printing, saving, uploading, faxing, or submitting completed forms.

Word documents should be saved as PDF before use. This tool depends on fixed PDF coordinates, and DOC/DOCX layout may shift during conversion.

## Normal workflow

1. Open Form Setup.
2. Upload a blank PDF.
3. Add and position fields.
4. Save Form Mapping.
5. Open Form Filler.
6. Load the PDF and mapping file, or continue from the current setup session.
7. Paste or enter values.
8. Select Print Completed Form to download the completed PDF.

## Files

- PDF: the blank/static form
- Mapping file: reusable JSON file containing field positions and layout metadata
- Completed form: generated filled PDF

## Limitations

- PDF/static forms only
- No native DOC/DOCX support
- Single-line text fields only
- Output should always be reviewed manually
- Browser and PDF rendering differences may affect alignment

## License

FormONE is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

You may use, copy, modify, and share this software for noncommercial purposes.

Commercial use, resale, paid hosting, or incorporation into a commercial product or service requires written permission from the copyright holder.

## Disclaimer

This tool is provided as-is, without warranty. Users are responsible for ensuring appropriate use, device/network security, privacy compliance, and output verification.
