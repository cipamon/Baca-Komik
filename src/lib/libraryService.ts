import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase.ts';
import {
  DEFAULT_SETTINGS,
  PRIMARY_ADMIN_EMAIL,
  SEED_BOOKS,
  SEED_CATEGORIES,
} from '../types.ts';
import type {
  AdminUser,
  Book,
  Category,
  LibrarySettings,
  MemberAccount,
} from '../types.ts';

export function sanitizeId(raw: string, prefix = 'id'): string {
  const clean = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  return clean || `${prefix}_${Date.now()}`;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 75) || `kat-${Date.now()}`
  );
}

function buildSanitizedBookPayload(
  input: Partial<Book> & { id: string },
  uid: string,
  isUpdate: boolean,
  existingCreatedAt?: unknown,
  existingCreatedBy?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: sanitizeId(input.id, 'bk'),
    code: String(input.code || `BK-${String(Date.now()).slice(-4)}`).trim().slice(0, 40),
    title: String(input.title || 'Komik Tanpa Judul').trim().slice(0, 240),
    author: String(input.author || 'Penulis').trim().slice(0, 160),
    category: String(input.category || 'Komik Nusantara').trim().slice(0, 80),
    year: Math.min(2100, Math.max(1900, Math.round(Number(input.year) || new Date().getFullYear()))),
    pdfUrl: String(input.pdfUrl || '/api/sample-pdf').trim().slice(0, 1500),
    status: input.status === 'hidden' ? 'hidden' : 'published',
    recommended: Boolean(input.recommended),
    readCount: Math.max(0, Math.round(Number(input.readCount) || 0)),
    downloadCount: Math.max(0, Math.round(Number(input.downloadCount) || 0)),
    createdBy: isUpdate && existingCreatedBy ? existingCreatedBy : uid,
    createdAt: isUpdate && existingCreatedAt ? existingCreatedAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.isbn !== undefined && input.isbn !== '') {
    payload.isbn = String(input.isbn).trim().slice(0, 40);
  }
  if (input.publisher !== undefined && input.publisher !== '') {
    payload.publisher = String(input.publisher).trim().slice(0, 120);
  }
  if (input.language !== undefined && input.language !== '') {
    payload.language = String(input.language).trim().slice(0, 40);
  }
  if (input.pages !== undefined && Number.isFinite(Number(input.pages))) {
    payload.pages = Math.min(10000, Math.max(0, Math.round(Number(input.pages))));
  }
  if (input.description !== undefined && input.description !== '') {
    payload.description = String(input.description).trim().slice(0, 4000);
  }
  if (input.coverUrl !== undefined && input.coverUrl !== '') {
    payload.coverUrl = String(input.coverUrl).trim().slice(0, 1500);
  }

  return payload;
}

export async function verifyAndEnsureAdminProfile(
  uid: string,
  email: string | null,
  displayName: string | null
): Promise<AdminUser | null> {
  const path = `admins/${uid}`;
  try {
    const docRef = doc(db, 'admins', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as AdminUser;
    }

    if (email && email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      const adminPayload: AdminUser = {
        uid,
        email,
        displayName: (displayName || 'Admin Utama').slice(0, 120),
        role: 'super_admin',
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, adminPayload);
      return adminPayload;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchBooksFromFirestore(isAdmin: boolean): Promise<Book[]> {
  const path = 'books';
  try {
    const colRef = collection(db, 'books');
    const q = isAdmin ? colRef : query(colRef, where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Book), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchCategoriesFromFirestore(): Promise<Category[]> {
  const path = 'categories';
  try {
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchSettingsFromFirestore(): Promise<LibrarySettings | null> {
  const path = 'settings/general';
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (!snap.exists()) return null;
    return snap.data() as LibrarySettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveBookToFirestore(
  book: Partial<Book> & { id?: string },
  existingBook?: Book | null
): Promise<Book> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  const bookId = sanitizeId(book.id || existingBook?.id || `bk_${Date.now()}`, 'bk');
  const path = `books/${bookId}`;

  try {
    const payload = buildSanitizedBookPayload(
      { ...book, id: bookId },
      uid,
      Boolean(existingBook),
      existingBook?.createdAt,
      existingBook?.createdBy
    );
    await setDoc(doc(db, 'books', bookId), payload);
    return {
      ...(existingBook || {}),
      ...book,
      ...payload,
      id: bookId,
    } as Book;
  } catch (error) {
    handleFirestoreError(error, existingBook ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBookFromFirestore(bookId: string): Promise<void> {
  const path = `books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function bulkUpdateBooksInFirestore(
  books: Book[],
  patch: Partial<Pick<Book, 'category' | 'year' | 'status' | 'recommended'>>
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  const path = 'books';
  try {
    const chunkSize = 400;
    for (let i = 0; i < books.length; i += chunkSize) {
      const batch = writeBatch(db);
      const slice = books.slice(i, i + chunkSize);
      for (const b of slice) {
        const merged = { ...b, ...patch };
        const payload = buildSanitizedBookPayload(merged, uid, true, b.createdAt, b.createdBy);
        batch.set(doc(db, 'books', b.id), payload);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bulkDeleteBooksInFirestore(bookIds: string[]): Promise<void> {
  const path = 'books';
  try {
    const chunkSize = 400;
    for (let i = 0; i < bookIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      for (const id of bookIds.slice(i, i + chunkSize)) {
        batch.delete(doc(db, 'books', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function bulkCreateBooksInFirestore(items: Array<Partial<Book>>): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  const path = 'books';
  try {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const batch = writeBatch(db);
      const slice = items.slice(i, i + chunkSize);
      slice.forEach((item, idx) => {
        const id = sanitizeId(item.id || `bk_${Date.now()}_${i + idx}`, 'bk');
        const payload = buildSanitizedBookPayload({ ...item, id }, uid, false);
        batch.set(doc(db, 'books', id), payload);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveCategoryToFirestore(
  cat: { id?: string; name: string; description?: string },
  existingCat?: Category | null
): Promise<Category> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  const id = sanitizeId(cat.id || existingCat?.id || `cat_${slugify(cat.name)}`, 'cat');
  const path = `categories/${id}`;

  const payload: Record<string, unknown> = {
    id,
    name: cat.name.trim().slice(0, 80),
    slug: slugify(cat.name),
    createdBy: existingCat?.createdBy || uid,
    createdAt: existingCat?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cat.description && cat.description.trim()) {
    payload.description = cat.description.trim().slice(0, 400);
  }

  try {
    await setDoc(doc(db, 'categories', id), payload);
    return { ...(existingCat || {}), ...payload } as Category;
  } catch (error) {
    handleFirestoreError(error, existingCat ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCategoryFromFirestore(categoryId: string): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSettingsToFirestore(settings: LibrarySettings): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  const path = 'settings/general';
  const payload = {
    libraryName: settings.libraryName.trim().slice(0, 100) || DEFAULT_SETTINGS.libraryName,
    tagline: settings.tagline.trim().slice(0, 240),
    itemsPerPage: Math.min(60, Math.max(6, Math.round(Number(settings.itemsPerPage) || 24))),
    allowGuestDownload: Boolean(settings.allowGuestDownload),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'settings', 'general'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncMemberMirrorToFirestore(
  member: MemberAccount,
  isUpdate: boolean
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const id = sanitizeId(member.id, 'mem');
  const path = `members/${id}`;
  try {
    const ref = doc(db, 'members', id);
    if (isUpdate) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          username: member.username.slice(0, 50),
          fullName: member.fullName.slice(0, 120),
          active: Boolean(member.active),
          updatedAt: serverTimestamp(),
        });
        return;
      }
    }
    await setDoc(ref, {
      id,
      username: member.username.slice(0, 50),
      fullName: member.fullName.slice(0, 120),
      active: Boolean(member.active),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMemberMirrorFromFirestore(memberId: string): Promise<void> {
  const id = sanitizeId(memberId, 'mem');
  const path = `members/${id}`;
  try {
    await deleteDoc(doc(db, 'members', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDemoCatalogToFirestore(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Autentikasi Admin diperlukan.');
  try {
    const batch = writeBatch(db);

    for (const cat of SEED_CATEGORIES) {
      batch.set(doc(db, 'categories', cat.id), {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const book of SEED_BOOKS) {
      const payload = buildSanitizedBookPayload(book, uid, false);
      batch.set(doc(db, 'books', book.id), payload);
    }

    batch.set(doc(db, 'settings', 'general'), {
      libraryName: DEFAULT_SETTINGS.libraryName,
      tagline: DEFAULT_SETTINGS.tagline,
      itemsPerPage: DEFAULT_SETTINGS.itemsPerPage,
      allowGuestDownload: DEFAULT_SETTINGS.allowGuestDownload,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_demo');
  }
}
