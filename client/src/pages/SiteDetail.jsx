import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, usersApi, billsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'
import { ExpenseTable, ExpenseForm, ExpenseFilters } from '@/components/expenses'
import { BillForm, BillActions } from '@/components/bills'
import { formatCurrency, formatDate, STATUS_COLORS, ROLE_NAMES, ROLE_COLORS } from '@/lib/utils'
import { Plus, UserPlus, X, CheckCircle, Ban, DollarSign, Wallet, Users as UsersIcon } from 'lucide-react'
import {
  PageLayout, PageHeader, SummaryBanner, ListItem, ActionBtn, EmptyState,
} from '@/components/page'

const FUND_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  disbursed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const BILL_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  credited: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function SiteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canManageUsers, isAdmin, user: currentUser } = useAuth()
  const permissions = useExpensePermissions()
  const { toast } = useToast()

  const [site, setSite] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [bills, setBills] = useState([])
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(null)
  const [fundSummary, setFundSummary] = useState(null)
  const [fundAllocations, setFundAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [billsLoading, setBillsLoading] = useState(false)

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAssignUserOpen, setIsAssignUserOpen] = useState(false)
  const [isAddBillOpen, setIsAddBillOpen] = useState(false)
  const [billActionState, setBillActionState] = useState({ isOpen: false, bill: null, action: 'approve' })

  const [expenseFilters, setExpenseFilters] = useState({ category: '', startDate: '', endDate: '' })

  useEffect(() => { fetchSiteData() }, [id])

  useEffect(() => {
    if (site) {
      fetchExpenses()
      if (isAdmin) fetchBills()
    }
  }, [site, expenseFilters])

  const fetchSiteData = async () => {
    setLoading(true)
    try {
      const [siteRes, summaryRes, fundsRes] = await Promise.all([
        sitesApi.getOne(id),
        expensesApi.getSummary(id),
        sitesApi.getFunds(id),
      ])
      setSite(siteRes.data)
      setSummary(summaryRes.data)
      setFundSummary(fundsRes.data.summary)
      setFundAllocations(fundsRes.data.allocations || [])
      if (canManageUsers) {
        const usersRes = await usersApi.getAll()
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
      }
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to load site', variant: 'destructive' })
      navigate('/sites')
    } finally {
      setLoading(false)
    }
  }

  const fetchExpenses = async () => {
    setExpensesLoading(true)
    try {
      const params = { siteId: id, ...expenseFilters }
      Object.keys(params).forEach((key) => { if (!params[key]) delete params[key] })
      const res = await expensesApi.getAll(params)
      setExpenses(res.data?.expenses || [])
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' })
    } finally {
      setExpensesLoading(false)
    }
  }

  const fetchBills = async () => {
    setBillsLoading(true)
    try {
      const res = await billsApi.getAll({ siteId: id })
      setBills(res.data?.bills || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load bills', variant: 'destructive' })
    } finally {
      setBillsLoading(false)
    }
  }

  const handleAddExpenseSuccess = () => {
    setIsAddExpenseOpen(false)
    fetchExpenses()
    fetchSiteData()
    toast({ title: 'Expense added successfully' })
  }

  const handleAddBillSuccess = () => {
    setIsAddBillOpen(false)
    fetchBills()
    fetchSiteData()
    toast({ title: 'GST Bill added successfully' })
  }

  const handleBillActionSuccess = async () => {
    setBillActionState({ isOpen: false, bill: null, action: 'approve' })
    toast({ title: 'Bill updated successfully' })
    await fetchBills()
    await fetchSiteData()
  }

  const handleAssignUser = async (userId) => {
    try {
      await sitesApi.assign(id, userId)
      toast({ title: 'User assigned successfully' })
      setIsAssignUserOpen(false)
      fetchSiteData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to assign user', variant: 'destructive' })
    }
  }

  const handleUnassignUser = async (userId) => {
    try {
      await sitesApi.unassign(id, userId)
      toast({ title: 'User removed from site' })
      fetchSiteData()
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove user', variant: 'destructive' })
    }
  }

  const canRemoveUser = (u) => {
    if (isAdmin) return true
    if (currentUser.role === 2) return u.role === 3 || u.role === 4
    if (currentUser.role === 3) return u.role === 4
    return false
  }

  const getAvailableUsersForAssignment = () => {
    const unassigned = users.filter(u => !site.assignedUsers?.some(au => au._id === u._id))
    if (isAdmin) return unassigned
    if (currentUser.role === 2) return unassigned.filter(u => u.role === 3 || u.role === 4)
    if (currentUser.role === 3) return unassigned.filter(u => u.role === 4)
    return []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!site) return null

  const availableUsers = getAvailableUsersForAssignment()
  const remainingFunds = fundSummary?.remainingFunds || 0

  return (
    <PageLayout>
      <PageHeader
        title={site.name}
        subtitle={site.address || 'No address'}
        onBack={() => navigate('/sites')}
      >
        <Badge className={STATUS_COLORS[site.status]}>
          {site.status === 'on_hold' ? 'On Hold' : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
        </Badge>
      </PageHeader>

      {/* Fund Summary Banner */}
      <SummaryBanner
        color="teal"
        icon={<Wallet className="h-8 w-8" />}
        items={[
          { label: 'Remaining Funds', value: formatCurrency(remainingFunds) },
          { label: 'Disbursed', value: formatCurrency(fundSummary?.totalDisbursed || 0) },
          { label: 'Spent', value: formatCurrency(fundSummary?.totalExpenses || 0) },
        ]}
      />

      {/* Mini stat row */}
      <div className="px-4 pb-2 grid grid-cols-3 gap-2">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Allocated</p>
          <p className="text-sm font-bold text-slate-700">{formatCurrency(fundSummary?.totalAllocated || 0)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Expenses</p>
          <p className="text-sm font-bold text-slate-700">{summary?.totalEntries || 0} entries</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Team</p>
          <p className="text-sm font-bold text-slate-700">{site.assignedUsers?.length || 0} members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="expenses" className="flex-1 flex flex-col">
          <div className="px-4 border-b bg-white shrink-0">
            <TabsList className="h-10 bg-transparent border-0 gap-1 p-0">
              <TabsTrigger value="expenses" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg text-sm">Expenses</TabsTrigger>
              <TabsTrigger value="funds" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg text-sm">Funds</TabsTrigger>
              {isAdmin && <TabsTrigger value="bills" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg text-sm">GST Bills</TabsTrigger>}
              {canManageUsers && <TabsTrigger value="users" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg text-sm">Team</TabsTrigger>}
              <TabsTrigger value="summary" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg text-sm">Summary</TabsTrigger>
            </TabsList>
          </div>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="flex-1 mt-0">
            <div className="p-4 space-y-3">
              {permissions.canCreate && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setIsAddExpenseOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Expense
                  </Button>
                </div>
              )}
              <ExpenseFilters
                filters={expenseFilters}
                onChange={setExpenseFilters}
                onClear={() => setExpenseFilters({ category: '', startDate: '', endDate: '' })}
                hideSiteFilter={true}
              />
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <ExpenseTable
                  expenses={expenses}
                  loading={expensesLoading}
                  onRefresh={fetchExpenses}
                  showSiteColumn={false}
                />
              </div>
            </div>
          </TabsContent>

          {/* Funds Tab */}
          <TabsContent value="funds" className="flex-1 mt-0">
            {fundAllocations.length === 0 ? (
              <EmptyState
                message="No fund allocations for this site"
                icon={<Wallet className="h-12 w-12" />}
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {fundAllocations.map((allocation) => (
                  <ListItem
                    key={allocation._id}
                    avatar={allocation.fromUser?.name}
                    avatarColor="teal"
                    title={`${allocation.fromUser?.name || '—'} → ${allocation.toUser?.name || '—'}`}
                    subtitle={
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">{formatDate(allocation.allocationDate)}</span>
                        <span className="text-xs text-gray-400">• {allocation.purpose?.replace(/_/g, ' ')}</span>
                        {allocation.referenceNumber && <span className="text-xs text-gray-400">• {allocation.referenceNumber}</span>}
                      </div>
                    }
                    amount={formatCurrency(allocation.amount)}
                    badge={{ label: allocation.status, className: FUND_STATUS_COLORS[allocation.status] || '' }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* GST Bills Tab */}
          {isAdmin && (
            <TabsContent value="bills" className="flex-1 mt-0">
              <div className="p-4">
                <div className="flex justify-end mb-3">
                  <Button size="sm" onClick={() => setIsAddBillOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add GST Bill
                  </Button>
                </div>
              </div>
              {billsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : bills.length === 0 ? (
                <EmptyState message="No GST bills for this site" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {bills.map((bill) => (
                    <ListItem
                      key={bill._id}
                      avatar={bill.vendorName}
                      avatarColor="indigo"
                      title={bill.vendorName}
                      subtitle={
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-400">{formatDate(bill.billDate)}</span>
                          {bill.invoiceNumber && <span className="text-xs text-gray-400">• #{bill.invoiceNumber}</span>}
                          <span className="text-xs text-gray-400">• GST {bill.gstRate}%</span>
                          {bill.vendorGstNumber && <span className="text-xs text-gray-400">• GSTIN: {bill.vendorGstNumber}</span>}
                        </div>
                      }
                      amount={formatCurrency(bill.totalAmount)}
                      badge={{ label: bill.status, className: BILL_STATUS_COLORS[bill.status] || '' }}
                      actions={
                        <>
                          {bill.status === 'pending' && (
                            <>
                              <ActionBtn
                                onClick={() => setBillActionState({ isOpen: true, bill, action: 'approve' })}
                                title="Approve"
                                icon={CheckCircle}
                                hoverClass="hover:text-green-600 hover:bg-green-50"
                              />
                              <ActionBtn
                                onClick={() => setBillActionState({ isOpen: true, bill, action: 'reject' })}
                                title="Reject"
                                icon={Ban}
                                hoverClass="hover:text-red-600 hover:bg-red-50"
                              />
                            </>
                          )}
                          {bill.status === 'approved' && (
                            <ActionBtn
                              onClick={() => setBillActionState({ isOpen: true, bill, action: 'pay' })}
                              title="Mark Paid"
                              icon={DollarSign}
                              hoverClass="hover:text-teal-600 hover:bg-teal-50"
                            />
                          )}
                        </>
                      }
                    />
                  ))}
                </div>
              )}

              {/* GST Summary */}
              {bills.length > 0 && (
                <div className="px-4 pt-2 pb-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">GST Summary</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-gray-50 rounded-lg text-center">
                        <p className="text-[10px] text-gray-400">Base Amount</p>
                        <p className="text-sm font-bold">{formatCurrency(bills.reduce((s, b) => s + b.baseAmount, 0))}</p>
                      </div>
                      <div className="p-2 bg-orange-50 rounded-lg text-center">
                        <p className="text-[10px] text-orange-400">Total GST</p>
                        <p className="text-sm font-bold text-orange-600">{formatCurrency(bills.reduce((s, b) => s + b.gstAmount, 0))}</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded-lg text-center">
                        <p className="text-[10px] text-blue-400">Total w/ GST</p>
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(bills.reduce((s, b) => s + b.totalAmount, 0))}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded-lg text-center">
                        <p className="text-[10px] text-green-400">Total Bills</p>
                        <p className="text-sm font-bold text-green-600">{bills.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* Team Tab */}
          {canManageUsers && (
            <TabsContent value="users" className="flex-1 mt-0">
              <div className="p-4 flex justify-end">
                <Button size="sm" onClick={() => setIsAssignUserOpen(true)} className="bg-slate-700 hover:bg-slate-800 text-white">
                  <UserPlus className="h-4 w-4 mr-1" /> Assign Member
                </Button>
              </div>
              {site.assignedUsers?.length === 0 ? (
                <EmptyState message="No team members assigned" icon={<UsersIcon className="h-12 w-12" />} />
              ) : (
                <div className="divide-y divide-gray-100">
                  {site.assignedUsers?.map((u) => (
                    <ListItem
                      key={u._id}
                      avatar={u.name}
                      avatarColor={u.role === 2 ? 'blue' : u.role === 3 ? 'green' : 'amber'}
                      title={u.name}
                      subtitle={<span className="text-xs text-gray-400">{u.email}</span>}
                      badge={{ label: ROLE_NAMES[u.role], className: ROLE_COLORS[u.role] }}
                      actions={
                        canRemoveUser(u) && (
                          <ActionBtn
                            onClick={() => handleUnassignUser(u._id)}
                            title="Remove"
                            icon={X}
                            hoverClass="hover:text-red-600 hover:bg-red-50"
                          />
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Summary Tab */}
          <TabsContent value="summary" className="flex-1 mt-0">
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Category Breakdown</p>
              {!summary?.categoryBreakdown?.length ? (
                <p className="text-center text-gray-400 py-8 text-sm">No expense data available</p>
              ) : (
                <div className="space-y-2">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat._id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{cat.category}</p>
                        <p className="text-xs text-gray-400">{cat.count} entries</p>
                      </div>
                      <p className="font-bold text-gray-900">{formatCurrency(cat.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Expense Sheet */}
      <Sheet open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <SheetContent title={`Add Expense — ${site.name}`}>
          <div className="px-5 py-4">
            <ExpenseForm
              siteId={id}
              onSuccess={handleAddExpenseSuccess}
              onCancel={() => setIsAddExpenseOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add GST Bill Sheet */}
      <Sheet open={isAddBillOpen} onOpenChange={setIsAddBillOpen}>
        <SheetContent title={`Add GST Bill — ${site.name}`}>
          <div className="px-5 py-4">
            <BillForm
              siteId={id}
              onSuccess={handleAddBillSuccess}
              onCancel={() => setIsAddBillOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Bill Actions Dialog */}
      <BillActions
        bill={billActionState.bill}
        isOpen={billActionState.isOpen}
        onClose={() => setBillActionState({ isOpen: false, bill: null, action: 'approve' })}
        onSuccess={handleBillActionSuccess}
        action={billActionState.action}
      />

      {/* Assign User Dialog */}
      <Dialog open={isAssignUserOpen} onOpenChange={setIsAssignUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Team Member</DialogTitle>
            <DialogDescription>Select a member to assign to {site.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2 max-h-72 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">No available members to assign</p>
            ) : (
              availableUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-3 rounded-xl border hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleAssignUser(u._id)}
                >
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <Badge className={ROLE_COLORS[u.role]}>{ROLE_NAMES[u.role]}</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
