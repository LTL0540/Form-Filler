export function LocalProcessingNotice() {
  return (
    <section className="local-processing-notice">
      <h2>Local-only PDF generation</h2>
      <p>
        Uploaded PDFs, template fields, pasted text, and entered values are processed in
        this browser only. The filled PDF is generated locally with pdf-lib and downloaded
        from memory; field information and form values are not sent to a server.
      </p>
    </section>
  );
}
