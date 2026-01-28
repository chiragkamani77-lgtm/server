import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, usersApi } from '@/lib/api'
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
import { formatCurrency, STATUS_COLORS, ROLE_NAMES, ROLE_COLORS } from '@/lib/utils'
import { ArrowLeft, Plus, UserPlus, X } from 'lucide-react'

export default function SiteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canManageUsers, isAdmin, user: currentUser } = useAuth()
  const permissions = useExpensePermissions()
  const { toast } = useToast()

  const [site, setSite] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expensesLoading, setExpensesLoading] = useState(false)

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAssignUserOpen, setIsAssignUserOpen] = useState(false)

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
    }
  }, [site, expenseFilters])

  const fetchSiteData = async () => {
    setLoading(true)
    try {
      const [siteRes, summaryRes] = await Promise.all([
        sitesApi.getOne(id),
        expensesApi.getSummary(id),
      ])

      setSite(siteRes.data)
      setSummary(summaryRes.data)

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

  const handleAddExpenseSuccess = () => {
    setIsAddExpenseOpen(false)
    fetchExpenses()
    fetchSiteData() // Refresh summary
    toast({
      title: 'Success',
      description: 'Expense added successfully.',
    })
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalExpenses || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalEntries || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{site.assignedUsers?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
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
