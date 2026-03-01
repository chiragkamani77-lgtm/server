# Billing Site – Project Memory

## Tech Stack
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, React Router
- **Backend**: Node.js + Express + MongoDB
- **Component library**: `@radix-ui/*` primitives via shadcn

## User Preferences
- Non-technical users (supervisors, engineers, workers) — UI must be simple, clear labels, large tap targets
- **Khatabook-style UI**: dark sidebar, clean list rows (no tables), slide-in right Sheet for add/edit
- No repeated code — reusable page components in `client/src/components/page/`
- Form labels in plain language (e.g. "What did you buy?", "Supplier Name")
- Status options use emoji labels (e.g. "✅ Present", "❌ Absent")

## Roles
- Role 1 = Developer (Admin) — full access
- Role 2 = Engineer — can create supervisors/workers
- Role 3 = Supervisor — can create workers, has dailyRate
- Role 4 = Worker — has dailyRate

## Key Architecture Decisions
- **Full-bleed pages**: Layout has `p-6`; pages use `<PageLayout>` which applies `-m-6` to break out
- **Sheet** (slide-in panel) via custom `client/src/components/ui/sheet.jsx` built on `@radix-ui/react-dialog`
- **Auto-detect site**: non-admin users only have 1 site; `sitesApi.getAll()` → take `sites[0]._id`
- **ExpenseForm**: no category field; site auto-detected for non-admin

## Reusable Page Components (`client/src/components/page/`)
| Component | Purpose |
|-----------|---------|
| `PageLayout` | Full-bleed wrapper (`-m-6`, `flex flex-col min-h-full bg-gray-50`) |
| `PageHeader` | Sticky top bar with title, subtitle, action buttons (right) |
| `SummaryBanner` | Colored stats banner below header (colors: blue, indigo, green, slate, teal) |
| `SearchFilterBar` | Search input + optional children (date pickers, dropdowns) |
| `ListItem` + `ActionBtn` | Khatabook-style list row with avatar, title, badge, actions |
| `PagePagination` | Bottom prev/next page nav (only renders if pages > 1) |
| `EmptyState` | Centered empty placeholder with optional icon + action button |

Exported from `client/src/components/page/index.js`

## Color Scheme by Module
| Module | Color |
|--------|-------|
| Expenses | blue |
| Bills (GST) | indigo |
| Sites | teal |
| Users/Team | slate |
| Attendance | green |
| Worker Ledger | amber |
| Fund Allocations | blue |
| Dashboard | slate |

## Important Files
- `client/src/components/ui/sheet.jsx` — custom Sheet built on Radix Dialog
- `client/src/components/layout/Sidebar.jsx` — dark navy (bg-slate-900) sidebar
- `client/src/lib/api.js` — all API calls
- `client/src/context/AuthContext.jsx` — `useAuth()` → `{ user, isAdmin, isSupervisor, hasOrganization }`
- `client/src/hooks/use-bulk-select.js` — bulk delete helper
- `client/src/hooks/use-loading.js` — `withCreating()` wrapper
- `client/src/hooks/useExpensePermissions.js` — `canCreate`, `canEdit(e)`, `canDelete(e)`, `canApprove`

## Pages Refactored (Khatabook style)
- ✅ Expenses.jsx
- ✅ Bills.jsx
- ✅ Sites.jsx
- ✅ Users.jsx
- ✅ Attendance.jsx
- ✅ WorkerLedger.jsx
- ✅ FundAllocations.jsx
- ✅ Dashboard.jsx

## Known Issues / Reminders
- Always check for unused imports after rewriting (linter shows hints)
- SummaryBanner requires data to be loaded — show loading spinner before rendering
- Statistics/summary banners must always be visible on every page (user requirement)
- `SearchFilterBar` can be used with empty `search`/`onSearch` if page has no search (pass `search=""` `onSearch={()=>{}}`)
- Layout: NO top Header on desktop — sidebar is full-height (`h-screen sticky top-0`), logout moved to sidebar bottom. Mobile has a minimal topbar only.
- Header.jsx still exists but is no longer imported in Layout.jsx (desktop-only design)
