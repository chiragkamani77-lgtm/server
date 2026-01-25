import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, usersApi, categoriesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, STATUS_COLORS, ROLE_NAMES, ROLE_COLORS } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Upload, UserPlus, X } from 'lucide-react'

export default function SiteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, canManageUsers } = useAuth()
  const { toast } = useToast()

  const [site, setSite] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAssignUserOpen, setIsAssignUserOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    amount: '',
    description: '',
    vendorName: '',
    expenseDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [siteRes, expensesRes, categoriesRes, summaryRes] = await Promise.all([
        sitesApi.getOne(id),
        expensesApi.getAll({ siteId: id }),
        categoriesApi.getAll(),
        expensesApi.getSummary(id),
      ])

      setSite(siteRes.data)
      setExpenses(expensesRes.data.expenses)
      setCategories(categoriesRes.data)
      setSummary(summaryRes.data)

      if (canManageUsers) {
        const usersRes = await usersApi.getAll()
        setUsers(usersRes.data)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load site details',
        variant: 'destructive',
      })
      navigate('/sites')
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (e) => {
    e.preventDefault()
    try {
      const { data } = await expensesApi.create({
        siteId: id,
        categoryId: expenseForm.categoryId,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        vendorName: expenseForm.vendorName,
        expenseDate: expenseForm.expenseDate,
      })

      // Upload receipt if selected
      if (selectedFile) {
        await expensesApi.uploadReceipt(data._id, selectedFile)
      }

      toast({ title: 'Expense added successfully' })
      setIsAddExpenseOpen(false)
      setExpenseForm({
        categoryId: '',
        amount: '',
        description: '',
        vendorName: '',
        expenseDate: new Date().toISOString().split('T')[0],
      })
      setSelectedFile(null)
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add expense',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    try {
      await expensesApi.delete(expenseId)
      toast({ title: 'Expense deleted' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete expense',
        variant: 'destructive',
      })
    }
  }

  const handleAssignUser = async (userId) => {
    try {
      await sitesApi.assign(id, userId)
      toast({ title: 'User assigned successfully' })
      setIsAssignUserOpen(false)
      fetchData()
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
      fetchData()
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

  const availableUsers = users.filter(
    u => !site.assignedUsers?.some(au => au._id === u._id)
  )

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
          {site.address && (
            <p className="text-muted-foreground">{site.address}</p>
          )}
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

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsAddExpenseOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No expenses recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense._id}>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category?.name}</Badge>
                      </TableCell>
                      <TableCell>{expense.description || '-'}</TableCell>
                      <TableCell>{expense.vendorName || '-'}</TableCell>
                      <TableCell>{expense.user?.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {expense.receiptPath && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={expense.receiptPath} target="_blank" rel="noopener noreferrer">
                                <Upload className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {(isAdmin || expense.user?._id === user?._id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteExpense(expense._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {site.assignedUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnassignUser(u._id)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent>
          <form onSubmit={handleAddExpense}>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>
                Record a new expense for {site.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={expenseForm.categoryId}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, categoryId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="5000"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Cement purchase - 50 bags"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor Name</Label>
                <Input
                  value={expenseForm.vendorName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                  placeholder="ABC Suppliers"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt (optional)</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Add Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={isAssignUserOpen} onOpenChange={setIsAssignUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Site</DialogTitle>
            <DialogDescription>
              Select a user to assign to {site.name}
            </DialogDescription>
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
                  <Badge className={ROLE_COLORS[u.role]}>
                    {ROLE_NAMES[u.role]}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
