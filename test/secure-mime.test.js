import { describe, it, expect } from 'vitest';
import { detectSecureMime } from '../src/lib/secure-mime.js';

const model = (contentType, attachments = [], text = null) => ({
  headers: [{ key: 'Content-Type', value: contentType }],
  attachments,
  text,
});

describe('detectSecureMime', () => {
  it('reports nothing for an ordinary message', () => {
    expect(detectSecureMime(model('multipart/mixed; boundary=x')))
      .toEqual({ signed: false, encrypted: false, scheme: '' });
  });

  it('detects an S/MIME signed message', () => {
    const result = detectSecureMime(model('multipart/signed; protocol="application/pkcs7-signature"'));
    expect(result.signed).toBe(true);
    expect(result.scheme).toBe('S/MIME');
  });

  it('detects a signature carried as an attachment part', () => {
    const result = detectSecureMime(model('multipart/mixed', [{ mimeType: 'application/pkcs7-signature' }]));
    expect(result.signed).toBe(true);
  });

  it('detects an encrypted enveloped message', () => {
    const result = detectSecureMime(model('application/pkcs7-mime; smime-type=enveloped-data'));
    expect(result.encrypted).toBe(true);
  });

  it('does not call a signed-data wrapper encrypted', () => {
    expect(detectSecureMime(model('application/pkcs7-mime; smime-type=signed-data')).encrypted).toBe(false);
  });

  it('detects PGP encrypted mail and names the scheme', () => {
    const result = detectSecureMime(model('multipart/encrypted; protocol="application/pgp-encrypted"'));
    expect(result.encrypted).toBe(true);
    expect(result.scheme).toBe('PGP');
  });

  it('detects inline PGP in the text body', () => {
    const result = detectSecureMime(model('text/plain', [], '-----BEGIN PGP MESSAGE-----\nowEB'));
    expect(result.scheme).toBe('PGP');
  });

  it('survives a missing model', () => {
    expect(detectSecureMime(null).signed).toBe(false);
  });
});
