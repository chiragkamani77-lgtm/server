import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, usersApi, billsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useExpensePermissions } from '@/hooks/useExpensePermissions'
import { ExpenseTable, ExpenseForm, ExpenseFilters } from '@/components/expenses'
import { BillForm, BillActions } from '@/components/bills'
import { formatCurrency, STATUS_COLORS, ROLE_NAMES, ROLE_COLORS } from '@/lib/utils'
import { ArrowLeft, Plus, UserPlus, X, CheckCircle, Ban, DollarSign } from 'lucide-react'

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

  const [expenseFilters, setExpenseFilters] = useState({
    category: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    fetchSiteData()
  }, [id])

  useEffect(() => {
    if (site) {
      fetchExpenses()
      if (isAdmin) {
        fetchBills()
      }
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
        // Backend returns array directly
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
      }
    } catch (error) {
      console.error('Error loading site:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load site details',
        variant: 'destructive',
      })
      navigate('/sites')
    } finally {
      setLoading(false)
    }
  }

  const fetchExpenses = async () => {
    setExpensesLoading(true)
    try {
      const params = {
        siteId: id,
        ...expenseFilters,
      }

      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key]
      })

      const expensesRes = await expensesApi.getAll(params)
      setExpenses(expensesRes.data?.expenses || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load expenses',
        variant: 'destructive',
      })
    } finally {
      setExpensesLoading(false)
    }
  }

  const fetchBills = async () => {
    setBillsLoading(true)
    try {
      const billsRes = await billsApi.getAll({ siteId: id })
      setBills(billsRes.data?.bills || [])
    } catch (error) {
      console.error('Error loading bills:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load bills',
        variant: 'destructive',
      })
    } finally {
      setBillsLoading(false)
    }
  }

  const handleAddExpenseSuccess = () => {
    setIsAddExpenseOpen(false)
    fetchExpenses()
    fetchSiteData() // Refresh summary
    toast({
      title: 'Success',
      description: 'Expense added successfully.',
    })
  }

  const handleAddBillSuccess = () => {
    setIsAddBillOpen(false)
    fetchBills()
    fetchSiteData() // Refresh summary
    toast({
      title: 'Success',
      description: 'GST Bill added successfully.',
    })
  }

  const handleBillAction = (bill, action) => {
    setBillActionState({ isOpen: true, bill, action })
  }

  const handleBillActionSuccess = async () => {
    setBillActionState({ isOpen: false, bill: null, action: 'approve' })
    toast({
      title: 'Success',
      description: 'Bill updated successfully',
    })
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
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to assign user',
        variant: 'destructive',
      })
    }
  }

  const handleUnassignUser = async (userId) => {
    try {
      await sitesApi.unassign(id, userId)
      toast({ title: 'User removed from site' })
      fetchSiteData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove user',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!site) return null

  // Check if current user can remove a specific user from site
  const canRemoveUser = (user) => {
    // Developers can remove anyone
    if (isAdmin) return true

    // Engineers (role 2) can remove any supervisor or worker
    if (currentUser.role === 2) {
      return user.role === 3 || user.role === 4
    }

    // Supervisors (role 3) can remove any worker (role 4)
    if (currentUser.role === 3) {
      return user.role === 4
    }

    return false
  }

  // Filter users based on role for assignment
  const getAvailableUsersForAssignment = () => {
    const unassignedUsers = users.filter(
      (u) => !site.assignedUsers?.some((au) => au._id === u._id)
    )

    // Developers can assign anyone
    if (isAdmin) return unassignedUsers

    // Engineers can assign any supervisor or worker
    if (currentUser.role === 2) {
      return unassignedUsers.filter(u => u.role === 3 || u.role === 4)
    }

    // Supervisors can assign any worker
    if (currentUser.role === 3) {
      return unassignedUsers.filter(u => u.role === 4)
    }

    return []
  }

  const availableUsers = getAvailableUsersForAssignment()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sites')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{site.name}</h1>
            <Badge className={STATUS_COLORS[site.status]}>
              {site.status.replace('_', ' ')}
            </Badge>
          </div>
          {site.address && <p className="text-muted-foreground">{site.address}</p>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Funds Allocated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(fundSummary?.totalAllocated || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending: {formatCurrency(fundSummary?.totalPending || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Funds Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(fundSummary?.totalDisbursed || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available to spend
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(fundSummary?.totalExpenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending: {formatCurrency(fundSummary?.pendingExpenses || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Remaining Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(fundSummary?.remainingFunds || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(fundSummary?.remainingFunds || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fundSummary?.utilizationPercentage || 0}% utilized
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expense Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalEntries || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{site.assignedUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Team members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="funds">Funds</TabsTrigger>
          {isAdmin && <TabsTrigger value="bills">GST Bills</TabsTrigger>}
          {canManageUsers && <TabsTrigger value="users">Team</TabsTrigger>}
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Expenses Tab - Using Reusable Components */}
        <TabsContent value="expenses" className="space-y-4">
          {/* Add Expense Button */}
          {permissions.canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setIsAddExpenseOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          )}

          {/* Expense Filters */}
          <ExpenseFilters
            filters={expenseFilters}
            onChange={setExpenseFilters}
            onClear={() =>
              setExpenseFilters({
                category: '',
                startDate: '',
                endDate: '',
              })
            }
            hideSiteFilter={true}
          />

          {/* Expense Table */}
          <Card>
            <CardContent className="pt-6">
              <ExpenseTable
                expenses={expenses}
                loading={expensesLoading}
                onRefresh={fetchExpenses}
                showSiteColumn={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funds Tab */}
        <TabsContent value="funds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fund Allocations</CardTitle>
              <CardDescription>Funds allocated to this site</CardDescription>
            </CardHeader>
            <CardContent>
              {fundAllocations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No fund allocations for this site yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fundAllocations.map((allocation) => (
                      <TableRow key={allocation._id}>
                        <TableCell>
                          {new Date(allocation.allocationDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {allocation.fromUser?.name}
                        </TableCell>
                        <TableCell>{allocation.toUser?.name}</TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(allocation.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {allocation.purpose?.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              allocation.status === 'disbursed'
                                ? 'bg-green-100 text-green-800'
                                : allocation.status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : allocation.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {allocation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {allocation.referenceNumber || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GST Bills Tab (Developer Only) */}
        {isAdmin && (
          <TabsContent value="bills" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsAddBillOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add GST Bill
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>GST Bills</CardTitle>
                <CardDescription>Bills and invoices with GST for this site</CardDescription>
              </CardHeader>
              <CardContent>
                {billsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : bills.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No GST bills for this site yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Base Amount</TableHead>
                        <TableHead>GST %</TableHead>
                        <TableHead>GST Amount</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((bill) => (
                        <TableRow key={bill._id}>
                          <TableCell>
                            {new Date(bill.billDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{bill.vendorName}</div>
                            {bill.vendorGstNumber && (
                              <div className="text-xs text-muted-foreground">
                                GSTIN: {bill.vendorGstNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{bill.invoiceNumber || '-'}</TableCell>
                          <TableCell>{formatCurrency(bill.baseAmount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{bill.gstRate}%</Badge>
                          </TableCell>
                          <TableCell className="text-orange-600">
                            {formatCurrency(bill.gstAmount)}
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(bill.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {bill.billType?.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                bill.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : bill.status === 'approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : bill.status === 'credited'
                                  ? 'bg-purple-100 text-purple-800'
                                  : bill.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {bill.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => handleBillAction(bill, 'approve')}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-600 hover:text-red-700"
                                  onClick={() => handleBillAction(bill, 'reject')}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {bill.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleBillAction(bill, 'pay')}
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* GST Summary for this site */}
                {bills.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold mb-4">GST Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-muted-foreground">Total Base Amount</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(bills.reduce((sum, b) => sum + b.baseAmount, 0))}
                        </p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <p className="text-xs text-muted-foreground">Total GST</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(bills.reduce((sum, b) => sum + b.gstAmount, 0))}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-xs text-muted-foreground">Total Amount</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(bills.reduce((sum, b) => sum + b.totalAmount, 0))}
                        </p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-muted-foreground">Total Bills</p>
                        <p className="text-lg font-bold text-green-600">
                          {bills.length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Users Tab */}
        {canManageUsers && (
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsAssignUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign User
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {site.assignedUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No users assigned
                      </TableCell>
                    </TableRow>
                  ) : (
                    site.assignedUsers?.map((u) => (
                      <TableRow key={u._id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge className={ROLE_COLORS[u.role]}>
                            {ROLE_NAMES[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canRemoveUser(u) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUnassignUser(u._id)}
                              title="Remove from site"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Expenses by category</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.categoryBreakdown?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No expense data available
                </p>
              ) : (
                <div className="space-y-4">
                  {summary?.categoryBreakdown?.map((cat) => (
                    <div key={cat._id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cat.category}</p>
                        <p className="text-sm text-muted-foreground">{cat.count} entries</p>
                      </div>
                      <p className="font-bold">{formatCurrency(cat.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog - Using Reusable Form */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expense to {site.name}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            siteId={id}
            onSuccess={handleAddExpenseSuccess}
            onCancel={() => setIsAddExpenseOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add GST Bill Dialog - Using Reusable Form */}
      <Dialog open={isAddBillOpen} onOpenChange={setIsAddBillOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add GST Bill to {site.name}</DialogTitle>
          </DialogHeader>
          <BillForm
            siteId={id}
            onSuccess={handleAddBillSuccess}
            onCancel={() => setIsAddBillOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Bill Actions Dialog (Approve/Pay/Reject) */}
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
            <DialogTitle>Assign User to Site</DialogTitle>
            <DialogDescription>Select a user to assign to {site.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {availableUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No available users to assign
              </p>
            ) : (
              availableUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => handleAssignUser(u._id)}
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge className={ROLE_COLORS[u.role]}>{ROLE_NAMES[u.role]}</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
