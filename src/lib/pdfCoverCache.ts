import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getProxiedPdfUrl } from './pdfUtils.ts';

// Configure PDF.js worker using bundled local URL (no external CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const DB_NAME = 'baca_komik_covers_v1';
const STORE_NAME = 'covers';
const DB_VERSION = 1;

// Tier 1: Fast in-memory RAM cache
const ramCoverCache = new Map<string, string>();
const activeJobs = new Map<string, Promise<string | null>>();

// Concurrency queue (max 2 simultaneous PDF page-1 renders to keep scrolling smooth)
const MAX_CONCURRENT = 2;
let runningCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (runningCount < MAX_CONCURRENT) {
    runningCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      runningCount += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  runningCount = Math.max(0, runningCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openCoverDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
  });
  return dbPromise;
}

function makeCacheKey(bookId: string, pdfUrl: string): string {
  return `${bookId}::${pdfUrl}`;
}

async function getFromIndexedDb(key: string): Promise<string | null> {
  try {
    const db = await openCoverDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as { dataUrl?: string } | undefined;
        resolve(res?.dataUrl || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDb(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openCoverDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB quota errors
  }
}

export function getCachedCoverSync(bookId: string, pdfUrl: string): string | null {
  return ramCoverCache.get(makeCacheKey(bookId, pdfUrl)) || null;
}

export async function renderAndCachePdfCover(bookId: string, pdfUrl: string): Promise<string | null> {
  if (!pdfUrl) return null;
  const cacheKey = makeCacheKey(bookId, pdfUrl);

  // 1. RAM cache
  const ramHit = ramCoverCache.get(cacheKey);
  if (ramHit) return ramHit;

  // 2. Deduplicate concurrent render requests
  const existingJob = activeJobs.get(cacheKey);
  if (existingJob) return existingJob;

  const job = (async () => {
    // 3. IndexedDB persistent cache
    const idbHit = await getFromIndexedDb(cacheKey);
    if (idbHit) {
      ramCoverCache.set(cacheKey, idbHit);
      return idbHit;
    }

    // 4. Render Page 1 via PDF.js using HTTP Range chunking
    await acquireSlot();
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    try {
      const targetUrl = getProxiedPdfUrl(pdfUrl);
      loadingTask = pdfjsLib.getDocument({
        url: targetUrl,
        rangeChunkSize: 65536,
        disableAutoFetch: true,
        disableStream: false,
      });

      const pdfDoc = await loadingTask.promise;
      const page = await pdfDoc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 280;
      const scale = targetWidth / Math.max(1, baseViewport.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        await pdfDoc.cleanup();
        return null;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      page.cleanup();
      await pdfDoc.cleanup();

      ramCoverCache.set(cacheKey, dataUrl);
      await saveToIndexedDb(cacheKey, dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      if (loadingTask) {
        try {
          await loadingTask.destroy();
        } catch {
          // Ignore destroy errors
        }
      }
      releaseSlot();
      activeJobs.delete(cacheKey);
    }
  })();

  activeJobs.set(cacheKey, job);
  return job;
}
