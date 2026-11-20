export function isLocalApiUrl(url: string): boolean {
  return url.startsWith('/') || url.startsWith(window.location.origin);
}

export function getGoogleDriveFileId(url: string): string | null {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (openMatch?.[1]) return openMatch[1];
  const ucMatch = url.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i);
  if (ucMatch?.[1]) return ucMatch[1];
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return getGoogleDriveFileId(url) !== null;
}

export function getGoogleDrivePreviewUrl(url: string): string | null {
  const id = getGoogleDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function getGoogleViewUrl(url: string): string {
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

export function getProxiedPdfUrl(url: string): string {
  if (!url) return '';
  if (isLocalApiUrl(url)) return url;
  return `/api/proxy-pdf?url=${encodeURIComponent(url)}`;
}

const prewarmedUrls = new Set<string>();

export async function prewarmPdf(pdfUrl: string): Promise<void> {
  if (!pdfUrl || prewarmedUrls.has(pdfUrl)) return;
  prewarmedUrls.add(pdfUrl);
  const proxied = getProxiedPdfUrl(pdfUrl);
  try {
    await fetch(proxied, { method: 'HEAD' });
  } catch {
    // Silent background pre-warm
  }
}

export async function downloadPdfWithProgress(
  pdfUrl: string,
  filename: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const targetUrl = getProxiedPdfUrl(pdfUrl);
  const res = await fetch(targetUrl);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh PDF (HTTP ${res.status}).`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader();

  if (!reader) {
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
    onProgress?.(100);
    return;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        onProgress?.(Math.min(99, Math.round((received / total) * 100)));
      } else {
        onProgress?.(Math.min(95, Math.round((received / (received + 65536)) * 100)));
      }
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' });
  onProgress?.(100);
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const safeName = filename.replace(/[^a-zA-Z0-9._\-\s]/g, '_').trim() || 'baca-komik';
  const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
