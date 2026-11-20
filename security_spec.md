# Security Specification — CetakKas Firestore Rules

## 1. Data Invariants
1. **Strict Multi-Tenant Owner Isolation**: Every document across `shopProfiles`, `products`, `orders`, `transactions`, `materials`, `employees`, and `payrollLogs` belongs to a single verified user (`ownerId == request.auth.uid`). No cross-tenant reads, lists, writes, or deletes are permitted.
2. **Verified Identity Only**: All read/write operations require an authenticated Google user with `request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Timestamps**: `ownerId` and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal server `request.time`.
4. **Relational Integrity**: A `payrollLogs` entry cannot be created unless its referenced `employeeId` exists in `/employees/{employeeId}` and belongs to the same `request.auth.uid`.
5. **Volumetric & Array Boundaries**: Every string field enforces strict `.size()` limits; `orders.items` is bounded to 1–30 elements and `products.hppComponents` is bounded to 0–20 elements.
6. **Terminal State Protection**:
   - An `order` that is both `paymentStatus == 'lunas'` and `productionStatus == 'diambil'` is sealed from further mutations.
   - A `payrollLog` marked `status == 'dibayar'` is sealed from further mutations to preserve accounting integrity with the Cash Ledger.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Identity Spoofing**: Creating a product with `ownerId: "victim-uid"` while authenticated as `"attacker-uid"` -> MUST return `PERMISSION_DENIED`.
2. **Shadow / Ghost Field Injection**: Updating a `shopProfile` with an undeclared field `isAdmin: true` -> MUST return `PERMISSION_DENIED` via `hasOnly()`.
3. **Unverified Email Access**: Attempting to write to `transactions` when `request.auth.token.email_verified == false` -> MUST return `PERMISSION_DENIED`.
4. **Path ID Poisoning**: Creating a document at `/products/../../evil$id!` or a 500-char ID -> MUST return `PERMISSION_DENIED` via `isValidId()`.
5. **Cross-Tenant List Scraping**: Querying `collection(db, 'orders')` without `where('ownerId', '==', uid)` -> MUST return `PERMISSION_DENIED` via `allow list: if isSignedIn() && existing().ownerId == request.auth.uid`.
6. **Orphaned Payroll Record**: Creating a `payrollLog` referencing a non-existent `employeeId` or another user's `employeeId` -> MUST return `PERMISSION_DENIED` via `exists()` + `get()` owner check.
7. **Timestamp Forgery**: Creating a `transaction` with a client-forged `createdAt` in the past instead of `serverTimestamp()` -> MUST return `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: Updating `ownerId` or `createdAt` on an existing `order` -> MUST return `PERMISSION_DENIED`.
9. **Terminal State Bypass (Payroll)**: Editing `netAmount` or `rate` on a `payrollLog` whose existing `status == 'dibayar'` -> MUST return `PERMISSION_DENIED`.
10. **Terminal State Bypass (Order)**: Modifying `totalAmount` on an `order` whose existing `paymentStatus == 'lunas'` and `productionStatus == 'diambil'` -> MUST return `PERMISSION_DENIED`.
11. **Value Poisoning / Type Mismatch**: Updating `sellPrice` on a `product` to a negative number `-5000` or string `"free"` -> MUST return `PERMISSION_DENIED` via `isValidProduct(incoming())`.
12. **Denial of Wallet Payload Oversize**: Submitting a 200KB `notes` string or 50-item `items` array in `orders` -> MUST return `PERMISSION_DENIED` via `.size()` caps.
