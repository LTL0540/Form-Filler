# Browser PDF Form Filler

Version 0.5.0

Browser PDF Form Filler is a client-side React app for building reusable PDF field templates and filling those PDFs from manual or newline-separated input. It is designed for simple clinical or administrative workflows where the PDF and entered values should stay on the user's machine.

## Repository Description

Browser-only PDF template builder and form filler with local PDF generation.

## Privacy Model

- No backend, API, database, authentication, or cloud storage.
- PDF files are uploaded into the browser session only.
- User-entered values stay in React memory only.
- Filled PDFs are generated locally in the browser with `pdf-lib`.
- Template JSON exports contain only non-PHI mapping metadata and coordinates.
- Clearing the session removes the current PDF, template, pasted text, and field values from memory.

## Features

- Upload and render PDF pages with `pdf.js`.
- Place draggable and resizable field boxes with `react-rnd`.
- Edit field number/order and display title.
- Export reusable template mapping JSON.
- Import mapping JSON later for fine-tuning or filling.
- Confirm whether an imported mapping matches the uploaded PDF name.
- Paste newline-separated values and apply them to fields by order.
- Generate a downloadable filled PDF entirely in the browser.
- Export a flattened/printed PDF copy for difficult source PDFs.
- Deploy automatically to GitHub Pages through GitHub Actions.

## Tech Stack

- React + Vite
- TypeScript
- `pdf.js` via `pdfjs-dist`
- `pdf-lib`
- `react-rnd`

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Deploy

GitHub Actions builds and deploys `dist` to GitHub Pages on pushes to `main`.

In the repository settings, set Pages source to **GitHub Actions**.

## Workflow

1. Open **Template Builder**.
2. Upload a blank PDF.
3. Add field boxes over the rendered PDF.
4. Set each field's number and title.
5. Export the template JSON, or use the current template immediately in **Form Filler**.
6. In **Form Filler**, upload the blank PDF and template JSON.
7. Enter values manually or paste newline-separated values and click **Apply Pasted Lines**.
8. Generate the filled PDF.
9. Use **Clear Values** or **Clear Session** when finished.

## Template JSON

Template exports include:

- `templateName`
- `templatePdfName`
- ordered `fields`
- each field's `key`, `label`, `type`, `page`, `x`, `y`, `width`, `height`, and `order`

Template exports do not include patient or user-entered values.

## License

MIT. See [LICENSE](LICENSE).
