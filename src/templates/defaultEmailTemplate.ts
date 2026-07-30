function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderDefaultEmailHtml(params: { subject: string; text?: string }): string {
  const bodyText = params.text ?? params.subject;
  const body = escapeHtml(bodyText).replace(/\n/g, "<br>");

  return `<!doctype html>
<html>
  <body style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #222;">
    <p>${body}</p>
  </body>
</html>`;
}
