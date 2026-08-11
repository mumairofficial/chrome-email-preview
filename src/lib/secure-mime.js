// Detection only. Nothing here decrypts or verifies a signature — the point is
// to say "this is signed" or "this is encrypted" instead of rendering an
// unreadable part and looking broken.

const SIGNATURE_TYPES = [
  'application/pkcs7-signature',
  'application/x-pkcs7-signature',
  'application/pgp-signature',
];

const ENCRYPTED_TYPES = [
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
  'application/pgp-encrypted',
];

function contentType(headers) {
  const found = (headers ?? []).find((h) => h.key?.toLowerCase() === 'content-type');
  return (found?.value ?? '').toLowerCase();
}

export function detectSecureMime(model) {
  const top = contentType(model?.headers);
  const attachmentTypes = (model?.attachments ?? []).map((a) => (a.mimeType ?? '').toLowerCase());

  const signed =
    top.includes('multipart/signed') ||
    attachmentTypes.some((t) => SIGNATURE_TYPES.includes(t));

  const encrypted =
    top.includes('multipart/encrypted') ||
    // smime-type=enveloped-data is the encrypted flavour of pkcs7-mime;
    // signed-data is merely a signature wrapper.
    /application\/(?:x-)?pkcs7-mime/.test(top) && !top.includes('signed-data') ||
    attachmentTypes.some((t) => ENCRYPTED_TYPES.includes(t));

  const pgp = top.includes('pgp') || attachmentTypes.some((t) => t.includes('pgp')) ||
    Boolean(model?.text && model.text.includes('-----BEGIN PGP MESSAGE-----'));

  return {
    signed: Boolean(signed),
    encrypted: Boolean(encrypted),
    scheme: pgp ? 'PGP' : signed || encrypted ? 'S/MIME' : '',
  };
}
