# Security Specification — Baca Komik Firestore Rules

## 1. Data Invariants
1. **Default Deny**: All unspecified paths under `/databases/{database}/documents` are strictly denied (`allow read, write: if false`).
2. **Admin Identity & Email Verification**: Only verified Google Sign-In users (`request.auth.token.email_verified == true`) whose UID exists in `/admins/{uid}` or whose email matches the primary admin (`faniku2021@gmail.com`) are granted administrative rights.
3. **Catalog Visibility**: Published books (`status == 'published'`) are readable by catalog visitors; hidden books (`status == 'hidden'`) are strictly restricted to verified admins on both `get` and `list` operations.
4. **Member Privacy**: Member directory records (`/members/{memberId}`) contain member identities and are strictly restricted to verified admins (`isAdmin()`). Password hashes (`scrypt`) and HMAC session tokens are never stored in readable client Firestore documents.
5. **Strict Schema & Immutability**: Every write validates required fields, allowed keys (`hasOnly`), string length bounds, ID regex (`^[a-zA-Z0-9_\\-]+$`), server timestamps (`request.time`), and immutable `createdAt`/`createdBy` fields on update.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `create` on `/books/book_1`
2. Authenticated non-admin `create` on `/books/book_2`
3. Unverified email (`email_verified: false`) claiming `faniku2021@gmail.com` attempting `write` on `/books/book_3`
4. Shadow field injection (`isAdmin: true`, `ghostField: 1`) on `/books/book_4`
5. Oversized string DoS (>1500 chars `pdfUrl` or >240 chars `title`) on `/books/book_5`
6. Invalid document ID poisoning (`../../etc/passwd` or >128 chars) on `/books/{bookId}`
7. Non-admin `list` or `get` on hidden book (`status == 'hidden'`)
8. Non-admin `get` or `list` on `/members/{memberId}` (PII / account leak)
9. Self-elevation `create` on `/admins/{uid}` by non-primary admin user
10. Client timestamp tampering (`createdAt != request.time`) on `create`
11. Immutable field mutation (`createdBy` or `createdAt` changed) on `update`
12. Out-of-range `itemsPerPage` (`itemsPerPage: 9999`) or missing required keys on `/settings/general`
