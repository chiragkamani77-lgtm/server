# Project Memory — Construction Site Management App

> Last updated: 2026-03-01
> Stack: React + Vite (client) · Node.js + Express + MongoDB (server)
> Roles: 1 = Developer (Admin) · 2 = Engineer · 3 = Supervisor · 4 = Worker

---

## 1. SYSTEM OVERVIEW

A real-estate / construction site expense management platform with:
- Multi-role access control (4 roles, strict hierarchy)
- Wallet-based fund distribution (Developer → Engineer → Supervisor → Worker)
- Expense / Bill approval workflows
- Attendance tracking with daily-rate salary calculation
- Worker ledger (advance, salary, deduction)
- Contract management (fixed / milestone / daily-rate)
- GST bill tracking with investment pool linkage
- PDF / Excel report generation

---

## 2. ROLE HIERARCHY

```
Developer (1)  ← Admin / Owner
    └── Engineer (2)  ← Site-level manager
            └── Supervisor (3)  ← On-ground team lead
                    └── Worker (4)  ← Labour
```

**Visibility rules (applied across all modules):**

| Module     | Developer | Engineer                          | Supervisor             | Worker    |
|------------|-----------|-----------------------------------|------------------------|-----------|
| Expenses   | All org   | Own + supervisors + workers (org) | Own + workers (org)    | Own only  |
| Bills      | All org   | All org                           | Own only               | Own only  |
| Attendance | All org   | All org                           | Own workers (org)      | Own only  |
| Ledger     | All org   | All org                           | Own workers (org)      | Own only  |
| Users      | All org   | Supervisors + workers (org)       | Workers (org)          | Self only |
| Funds      | All       | Own received + given              | Own received           | —         |

---

## 3. CURRENT IMPLEMENTATION — FEATURE INVENTORY

### 3.1 Authentication (`server/src/routes/auth.js`)
- POST /auth/login — JWT (access 1d + refresh 7d)
- POST /auth/register — first user auto-becomes Developer
- POST /auth/refresh — token renewal
- GET /auth/me — current user info
- **Client:** Login.jsx — login + register tabs, role dropdown

### 3.2 Sites (`server/src/routes/sites.js`)
Endpoints: CRUD + assign/unassign users + GET users/funds per site
**Client (old desktop):** Sites.jsx — add/edit sheet, status badges
**Client (new mobile):** DeveloperHome → Sites tab
Status values: `active` / `completed` / `on_hold`

### 3.3 Expenses (`server/src/routes/expenses.js`)
Endpoints: CRUD + bulk-delete + summary + approve + receipt-upload

Wallet hold system:
- **Developer**: auto-approved, wallet debited immediately
- **Engineer**: `pending`, amount = 0 until developer approves
- **Supervisor**: `pending`, wallet debited immediately (held)
  - On approve: difference adjusted
  - On reject: wallet credited back (refund)
  - On delete (pending): wallet credited back

**Client (old desktop):** Expenses.jsx — filters, pagination, receipt upload, bulk delete
**Client (new mobile):**
- SupervisorExpense.jsx → Expenses tab (own, delete on pending)
- EngineerHome.jsx → Expenses tab (own + supervisor, approve/reject others, delete own pending)

### 3.4 Bills (`server/src/routes/bills.js`)
Endpoints: CRUD + bulk-delete + summary + approve + status-update + receipt + CSV export + vendor suggestions

GST rates: 0 / 5 / 12 / 18 / 28 %
Status flow: `pending` → `approved` / `credited` / `paid` / `rejected`
Auto-creates Investment record when bill → `credited`

Visibility:
- Developer (1): all org bills
- Engineer (2): all org bills (supervisor bills visible)
- Supervisor/Worker (3+): only own bills (`createdBy = req.user._id`)

**Client (old desktop):** Bills.jsx — GST calc, fund allocation selector, vendor autocomplete, CSV export
**Client (new mobile):**
- SupervisorExpense.jsx → Bills tab (own only — view + add)
- EngineerHome.jsx → Bills tab (all org, shows createdBy — view + add)

### 3.5 Attendance (`server/src/routes/attendance.js`)
Endpoints: CRUD + bulk-create + bulk-delete + summary + CSV export template + import
Creates pending-salary ledger entry when daily-rate worker is marked present / half_day

**Client (old desktop):** Attendance.jsx — bulk entry, CSV import/export
**Client (new mobile):**
- SupervisorExpense.jsx → Attendance tab (mark + delete)
- EngineerHome.jsx → Attendance tab (mark + delete)

### 3.6 Worker Ledger (`server/src/routes/ledger.js`)
Endpoints: CRUD + bulk-delete + balance + pending-salary + pay-salary + all-pending-salaries + bulk-pay-salary

Entry types: `credit` / `debit`
Categories: salary / advance / bonus / deduction / reimbursement / contract_payment / pending_salary / other

**Client (old desktop):** WorkerLedger.jsx — pay-salary dialog, bulk pay, advance deduction
**Client (new mobile):**
- SupervisorExpense.jsx → Ledger tab (record payment + delete)
- EngineerHome.jsx → Ledger tab (record payment + delete)

### 3.7 Fund Allocations (`server/src/routes/funds.js`)
Endpoints: CRUD + status-update + my-summary + utilization + flow-summary + wallet-summary + investment-pool-summary

Wallet system: every user has `walletBalance`; allocation credits receiver, debits sender atomically (mongoose transaction)

**Client (old desktop):** FundAllocations.jsx — utilization breakdown, fund flow overview
**Client (new mobile):**
- EngineerHome.jsx → Funds tab (view list + allocate to supervisors)
- DeveloperHome.jsx → Funds tab (partially built)

### 3.8 Users (`server/src/routes/users.js`)
Endpoints: CRUD + GET /my/children (includes parent manager with `isParent: true` flag)

**Client (old desktop):** Users.jsx — role assign, daily rate, password change
**Client (new mobile):**
- SupervisorExpense.jsx → Members tab (workers + parent engineer, wallet balance shown)
- EngineerHome.jsx → Members tab (supervisors + workers + parent developer, wallet shown)

### 3.9 Contracts (`server/src/routes/contracts.js`)
Endpoints: CRUD + activate + record-payment + attendance-salary + summary

Types: `fixed` / `milestone` / `daily`
Installment tracking; auto-progress percentage virtual; auto-complete at 100%

**Client (old desktop):** Contracts.jsx — installment grid, payment dialog, attendance-based salary
**Client (new mobile):** ❌ NOT implemented yet

### 3.10 Investments (`server/src/routes/investments.js`)
Endpoints: CRUD + summary + withdraw

Types: partner / bill (auto-generated from credited bills) / loan / grant

**Client (old desktop):** Investments.jsx — partner list, withdraw dialog
**Client (new mobile):** ❌ NOT implemented (DeveloperHome tab placeholder only)

### 3.11 Reports (`server/src/routes/reports.js`)
Endpoints: site report + PDF download + Excel download + org summary

**Client (old desktop):** Reports.jsx — date filters, chart, PDF/Excel export
**Client (new mobile):** ❌ NOT implemented (DeveloperHome tab placeholder)

### 3.12 Organizations (`server/src/routes/organizations.js`)
Endpoints: CRUD + partners + summary

**Client (old desktop):** Organization.jsx — settings page
**Client (new mobile):** ❌ NOT implemented (not needed for non-admin roles)

### 3.13 Categories (`server/src/routes/categories.js`)
- Category field removed from Expense model entirely
- All forms: category defaults to `'other'` internally
- **Mobile:** Not needed

---

## 4. MOBILE UI — CURRENT STATE PER ROLE

### Role 1 — Developer (`DeveloperHome.jsx`)
Tabs: Overview · Sites · Investments · Funds · Users · Reports

| Tab | Status | Notes |
|-----|--------|-------|
| Overview | ✅ | Stats cards, monthly trend chart, top sites |
| Sites | ✅ | Site list, create form |
| Investments | 🔶 Partial | List only — no add / withdraw form |
| Funds | 🔶 Partial | Allocation list — no create form |
| Users | 🔶 Partial | List only — no add / edit |
| Reports | ❌ | Placeholder only |

### Role 2 — Engineer (`EngineerHome.jsx`)
Tabs: Expenses · Bills · Attendance · Ledger · Funds · Members

| Tab | Status | Notes |
|-----|--------|-------|
| Expenses | ✅ | List + add + approve/reject others + delete own pending |
| Bills | ✅ | All org list (shows createdBy) + add form |
| Attendance | ✅ | List + mark + delete |
| Ledger | ✅ | List + record payment + delete |
| Funds | ✅ | List + allocate to supervisors |
| Members | ✅ | Supervisors + workers with wallet, parent manager shown |

### Role 3 — Supervisor (`SupervisorExpense.jsx`)
Tabs: Expenses · Bills · Attendance · Ledger · Members

| Tab | Status | Notes |
|-----|--------|-------|
| Expenses | ✅ | Own list + add + delete pending |
| Bills | ✅ | Own list + add form |
| Attendance | ✅ | Workers list + mark + delete |
| Ledger | ✅ | List + record payment + delete |
| Members | ✅ | Workers with wallet balance, parent engineer shown |

### Role 4 — Worker (`WorkerHome.jsx`)
| Status | ❌ Not built |
|--------|------------|
| Planned tabs | My Attendance · My Payments |
| Notes | Read-only; supervisor manages their records |

---

## 5. PENDING IMPLEMENTATION

### 5.1 Features in backend/old desktop UI — NOT yet in mobile

| Feature | Backend | Old Desktop | Mobile Status | Priority |
|---------|---------|-------------|--------------|----------|
| Contracts module | ✅ Full | ✅ Full | ❌ Missing | High |
| Investments (add / withdraw) | ✅ Full | ✅ Full | ❌ Missing in DeveloperHome | High |
| DeveloperHome — Users CRUD | ✅ Full | ✅ Full | 🔶 List only | High |
| DeveloperHome — Funds create | ✅ Full | ✅ Full | 🔶 List only | High |
| Pay salary (from pending entries) | ✅ Full | ✅ Full | ❌ Missing | High |
| Reports + PDF / Excel export | ✅ Full | ✅ Full | ❌ Missing | Medium |
| Bulk attendance entry | ✅ Full | ✅ Full | ❌ Missing | Medium |
| Bulk pay salary | ✅ Full | ✅ Full | ❌ Missing | Medium |
| Expense receipt upload | ✅ Full | ✅ Full | ❌ Missing in mobile forms | Medium |
| Bill receipt upload | ✅ Full | ✅ Full | ❌ Missing in mobile forms | Medium |
| Fund utilization breakdown | ✅ Full | ✅ Full | ❌ Missing (Funds tab) | Medium |
| Worker (Role 4) mobile UI | — | — | ❌ Not started | Medium |
| Expense approval notes | ✅ Full | ✅ Full | ❌ Not in approve dialog | Low |
| Bill CSV export | ✅ Full | ✅ Full | ❌ Not in mobile | Low |
| Vendor autocomplete for bills | ✅ Full | ✅ Full | ❌ Not in BillForm mobile | Low |
| CSV attendance import | ✅ Full | ✅ Full | ❌ Missing | Low |

### 5.2 New features not built anywhere yet

| Feature | Notes | Priority |
|---------|-------|---------|
| Site dashboard per supervisor | Filter all tabs by site | High |
| Push notifications | Expense approved, fund received | Medium |
| Photo proof for expenses (camera) | Mobile-specific, native capture | Medium |
| Worker self-service login | View own attendance + payments | Medium |
| Offline / PWA | Field workers with poor connectivity | Low |
| WhatsApp / SMS payment confirmation | Worker notification | Low |

---

## 6. OLD DESKTOP UI vs NEW MOBILE UI

| Aspect | Old Desktop (shadcn tables) | New Mobile (MobileLayout) |
|--------|-----------------------------|--------------------------|
| Layout | Sidebar + full-page tables | Bottom tabs + FAB + bottom sheets |
| Navigation | React Router routes per section | Single page, tab-state driven |
| Data entry | Dialog / Sheet over table | Slide-up bottom sheet |
| Lists | shadcn Table with pagination | FeedItem feed list (limit=30) |
| Filters | SearchFilterBar (date pickers, dropdowns) | Simplified inline (not fully built) |
| Bulk operations | Checkboxes + bulk action bar | ❌ Not implemented in mobile |
| Pagination | PagePagination component | Load more / fixed limit |
| Row actions | Dropdown action menu | Inline icon buttons on feed item |
| Empty state | EmptyState component | EmptyFeed component |
| Role routing | All roles → Layout → same routes | Each role → dedicated page |
| Approval UI | Table row action → dialog | Inline approve/reject pill buttons |
| Wallet display | Header info bar | MobileHeader wallet chip |
| Site name | Page title / dropdown | Amber subtitle in MobileHeader |
| Old pages status | Still exist in pages/ but NOT imported in App.jsx | Replaced by role-dedicated pages |

---

## 7. CODE DUPLICATION — ANALYSIS & REMEDIATION

### 7.1 Current Duplications

| Duplication | Files | Fix |
|-------------|-------|-----|
| `TabLoader` spinner component | SupervisorExpense, EngineerHome, DeveloperHome | Extract `mobile/TabLoader.jsx` |
| `StatusMeta` dot + label | SupervisorExpense, EngineerHome | Extract `mobile/StatusMeta.jsx` |
| `handleDeleteX` pattern (confirm → api.delete → toast → reload) | Both role pages (3× each) | Extract `useDeleteAction(apiFn, reloadFn, msg)` hook |
| Bottom sheet wrapper (drag handle + title + padding) | Both role pages | Extract `MobileSheet` component |
| Data loader pattern (setLoading → try api → catch toast → finally) | Every tab in every role page | Extract `useTabData(fetchFn, transform)` hook |
| Attendance form JSX | SupervisorExpense, EngineerHome | Extract `AttendanceForm` component |
| Ledger / payment form JSX | SupervisorExpense, EngineerHome | Extract `LedgerForm` component |
| `EXPENSE_STATUS`, `ATTENDANCE_BADGE`, `BILL_STATUS`, `PAYMENT_MODES` constants | SupervisorExpense, EngineerHome | Move to `lib/constants.js` |

### 7.2 Hooks to Extract

```js
// client/src/hooks/useTabData.js
export function useTabData(fetchFn, transform = d => d) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await fetchFn(); setData(transform(res.data)) }
    catch { toast({ title: 'Error loading data', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [fetchFn, toast])
  return [data, loading, load]
}

// client/src/hooks/useDeleteAction.js
export function useDeleteAction(apiFn, reloadFn, confirmMsg) {
  const { toast } = useToast()
  return async (id) => {
    if (!window.confirm(confirmMsg)) return
    try { await apiFn(id); toast({ title: 'Deleted' }); reloadFn() }
    catch (err) { toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' }) }
  }
}
```

### 7.3 Components to Extract

```jsx
// client/src/components/mobile/MobileSheet.jsx
export function MobileSheet({ open, onClose, title, children }) {
  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
        <div className="px-5 pt-2 pb-6">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
          <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// client/src/components/mobile/TabLoader.jsx
export function TabLoader() {
  return <div className="flex justify-center py-16"><Loader className="h-6 w-6 animate-spin text-gray-300" /></div>
}

// client/src/components/mobile/StatusMeta.jsx
export function StatusMeta({ status, statusMap }) {
  const s = statusMap[status] || { dot: 'bg-gray-400', text: 'text-gray-500', label: status }
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}
```

---

## 8. PRODUCTION READINESS CHECKLIST

### 8.1 Server — Missing

| Item | Status | Action |
|------|--------|--------|
| Helmet.js (security headers) | ❌ | `app.use(helmet())` |
| Rate limiting | ❌ | `express-rate-limit` on auth + API routes |
| Global error handler | ❌ | `app.use((err, req, res, next) => ...)` |
| Input validation (zod / express-validator) | ❌ | Add on all create/update routes |
| Request size limit | ❌ | `express.json({ limit: '10mb' })` |
| HTTP request logging | ❌ | `morgan` |
| MongoDB connection retry | 🔶 | Basic connect only, no retry |
| File upload type validation | 🔶 | `multer` present but no MIME check |
| CORS explicit origins | 🔶 | Not locked to specific domain |
| Refresh token rotation / blocklist | ❌ | Stateless JWT only |
| Soft delete (audit trail) | ❌ | Hard deletes everywhere |
| Audit log | ❌ | No change history |
| Tests | ❌ | No test suite |
| Dockerfile / CI pipeline | ❌ | Not configured |

### 8.2 Frontend — Missing

| Item | Status | Action |
|------|--------|--------|
| React ErrorBoundary | ❌ | Wrap routes |
| Skeleton loading (vs spinner) | 🔶 | Spinners only |
| Client-side form validation | 🔶 | Server errors shown, no pre-validate |
| Receipt / image viewer in mobile | ❌ | Paths stored but no viewer |
| Offline detection banner | ❌ | No network state handling |
| PWA manifest + service worker | ❌ | Not configured |
| Bundle size analysis | ❌ | Run `vite build --report` |

### 8.3 Recommended Server Structure

```
server/src/
├── config/
│   ├── db.js            — MongoDB connection with retry
│   └── env.js           — Zod-validated env schema
├── middleware/
│   ├── auth.js          ✅ authenticate, requireRole, canManageUser
│   ├── errorHandler.js  ← global express error handler
│   ├── rateLimit.js     ← per-route rate limiters
│   └── validate.js      ← request body validation
├── models/              ✅
├── routes/              ✅
├── utils/
│   ├── walletHelper.js  ✅ debitWallet / creditWallet
│   ├── logger.js        ← morgan + winston
│   └── asyncWrapper.js  ← wraps handlers to auto-catch async errors
└── app.js
```

### 8.4 Recommended Client Structure

```
client/src/
├── components/
│   ├── mobile/
│   │   ├── MobileLayout.jsx   ✅
│   │   ├── MobileHeader.jsx   ✅
│   │   ├── TabStrip.jsx       ✅
│   │   ├── FAB.jsx            ✅
│   │   ├── FeedItem.jsx       ✅
│   │   ├── EmptyFeed.jsx      ✅
│   │   ├── TabLoader.jsx      ← extract
│   │   ├── MobileSheet.jsx    ← extract
│   │   ├── StatusMeta.jsx     ← extract
│   │   └── index.js
│   └── forms/
│       ├── ExpenseForm.jsx    ✅
│       ├── BillForm.jsx       ✅
│       ├── AttendanceForm.jsx ← extract
│       └── LedgerForm.jsx     ← extract
├── hooks/
│   ├── useTabData.js          ← extract data loading pattern
│   ├── useDeleteAction.js     ← extract delete + confirm pattern
│   └── use-toast.js           ✅
├── lib/
│   ├── api.js                 ✅
│   ├── utils.js               ✅
│   └── constants.js           ← extract all STATUS/BADGE maps
└── pages/
    ├── DeveloperHome.jsx
    ├── EngineerHome.jsx
    ├── SupervisorExpense.jsx
    └── WorkerHome.jsx         ← to be built
```

---

## 9. WALLET SYSTEM (Critical Architecture)

```
Investment Pool  ←─── Partner invests
       │
       ▼
  Developer wallet  ←─── credits from pool (creditWallet called on FundAllocation create)
       │  fundAllocation → disbursed (atomic transaction)
       ▼
  Engineer wallet  (transferWallet: debit Developer, credit Engineer)
       │  fundAllocation → disbursed
       ▼
  Supervisor wallet  ← balance shown in Engineer → Members tab
       │  fundAllocation → disbursed
       ▼
  Worker wallet  (future)

On expense submit (Supervisor):   debitWallet immediately (hold)
On expense approve:               adjust difference
On expense reject / delete:       creditWallet (refund)

On expense submit (Engineer):     amount = 0, no wallet touch
On expense approve by Developer:  debitWallet now
On expense reject:                no change needed
```

---

## 10. KEY FILE PATHS (Quick Reference)

| Path | Purpose |
|------|---------|
| `client/src/App.jsx` | Role-based routing |
| `client/src/lib/api.js` | All API call functions |
| `client/src/lib/utils.js` | formatCurrency, formatDate, cn() |
| `client/src/pages/SupervisorExpense.jsx` | Role 3 mobile page |
| `client/src/pages/EngineerHome.jsx` | Role 2 mobile page |
| `client/src/pages/DeveloperHome.jsx` | Role 1 mobile page |
| `client/src/components/mobile/` | Shared mobile UI primitives |
| `client/src/components/expenses/ExpenseForm.jsx` | Expense add form |
| `client/src/components/bills/BillForm.jsx` | Bill add form |
| `client/src/index.css` | scrollbar-hide, pb-safe, global base |
| `server/src/routes/expenses.js` | Expense API + wallet hold system |
| `server/src/routes/bills.js` | Bill API + GST + investment link |
| `server/src/routes/funds.js` | Wallet + allocation + pool |
| `server/src/routes/users.js` | User CRUD + /my/children hierarchy |
| `server/src/routes/ledger.js` | Worker salary + ledger |
| `server/src/routes/attendance.js` | Attendance + pending salary auto-create |
| `server/src/utils/walletHelper.js` | debitWallet / creditWallet |
| `server/src/middleware/auth.js` | authenticate / requireRole |

---

## 11. CONVENTIONS & DECISIONS

- `scrollbar-hide` CSS class: cross-browser, defined in `index.css`
- `pb-safe` CSS class: handles iPhone notch padding in bottom sheets
- `isParent: true` flag on `/users/my/children` marks parent manager (no wallet shown, no delete)
- Bills visibility: `filter.createdBy = req.user._id` for role ≥ 3 (not site-based)
- Expense visibility: org + role filter (not parent-child traversal)
- All wallet operations wrapped in `mongoose.startSession()` transactions
- FAB hidden on Members tab (no form to open) — `onFabClick={fabLabels[activeTab] ? ... : undefined}`
- Progressive form reveal: full form shown only when amount > 0 (autoFocus on amount)
- Category field: removed from Expense model entirely; WorkerLedger defaults to `'other'`
- Site auto-detected server-side from `assignedUsers`; not sent from frontend for non-admin
- Fund allocation auto-detected server-side (latest disbursed allocation for current user)
- Tab data lazy-loads on first switch via `useEffect([activeTab, ...loaders])`
- Old desktop pages (Dashboard, Sites, Expenses…) still exist in `pages/` but are NOT imported in App.jsx

---

## 12. TECH STACK DETAILS

### Frontend
- React 18 + Vite + React Router DOM
- Tailwind CSS + shadcn/ui (Radix primitives)
- Axios with JWT interceptor (auto-refresh on 401)
- lucide-react icons
- recharts (charts in DeveloperHome overview)

### Backend
- Node.js + Express
- MongoDB + Mongoose (transactions via `startSession()`)
- bcrypt (password hashing, 10 rounds)
- JWT (jsonwebtoken) — access 1d, refresh 7d
- multer (file uploads to /uploads/)

### Key npm packages (server)
- express, mongoose, bcryptjs, jsonwebtoken, multer, cors, dotenv

### Key npm packages (client)
- react, react-router-dom, axios, tailwindcss, @radix-ui/*, lucide-react, recharts, clsx, tailwind-merge
