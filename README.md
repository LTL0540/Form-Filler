# Browser PDF Form Filler

A browser-only MVP for creating PDF field templates and filling PDFs from those templates.

## Constraints

- No backend, server API, database, authentication, or cloud storage.
- User-entered values stay in React memory only.
- Only template mappings, which should not contain PHI, are exported as JSON.
- PDF rendering uses `pdf.js`; PDF writing uses `pdf-lib`; field boxes use `react-rnd`.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Deploy

GitHub Actions builds and deploys `dist` to GitHub Pages on pushes to `main`.
In the repository settings, set Pages source to **GitHub Actions**.

## Workflow

1. Open **Template Builder**.
2. Upload a PDF and add text fields over the rendered page.
3. Edit the template name and each field's label, key, and order.
4. Export the template JSON. The filename is derived from the PDF, such as `EAP_Form.mapping.json`, and the JSON contains only non-PHI template metadata and coordinates.
5. Re-import the template JSON later with the same blank PDF to show the mapped fields again.
6. Open **Form Filler**.
7. Upload the original PDF and template JSON.
8. Enter values manually or paste newline-separated values and click **Apply Pasted Lines**.
9. Generate the filled PDF, then use **Clear Values** or **Clear Session** when finished.
