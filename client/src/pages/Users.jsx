import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { ROLE_NAMES, ROLE_COLORS } from '@/lib/utils'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, EmptyState,
} from '@/components/page'
import { Plus, Edit, Trash2, Users as UsersIcon, UserCheck, UserX } from 'lucide-react'

export default function Users() {
  const { user: currentUser, isAdmin, isSupervisor } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '4',
    dailyRate: '',
  })

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await usersApi.getAll()
      setUsers(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      const userData = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: parseInt(form.role),
      }
      if (form.dailyRate && (form.role === '4' || form.role === '3')) {
        userData.dailyRate = parseFloat(form.dailyRate)
      }
      await usersApi.create(userData)
      toast({ title: 'User created successfully' })
      setSheetOpen(false)
      resetForm()
      fetchUsers()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to create user', variant: 'destructive' })
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      const updateData = { name: form.name, email: form.email }
      if (form.password) updateData.password = form.password
      if (editingUser.role === 4 || editingUser.role === 3) {
        updateData.dailyRate = parseFloat(form.dailyRate) || 0
      }
      await usersApi.update(editingUser._id, updateData)
      toast({ title: 'User updated' })
      setSheetOpen(false)
      setEditingUser(null)
      resetForm()
      fetchUsers()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update user', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await usersApi.delete(deleteId)
      toast({ title: 'User deleted' })
      setDeleteId(null)
      fetchUsers()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete user', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await usersApi.update(userId, { isActive: !currentStatus })
      toast({ title: `User ${currentStatus ? 'deactivated' : 'activated'}` })
      fetchUsers()
    } catch {
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' })
    }
  }

  const openAdd = () => {
    setEditingUser(null)
    resetForm()
    setSheetOpen(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role.toString(),
      dailyRate: user.dailyRate?.toString() || '',
    })
    setSheetOpen(true)
  }

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: '4', dailyRate: '' })
  }

  const canManageUser = (u) => {
    if (u._id === currentUser._id) return false
    if (isAdmin) return true
    if (u.role <= currentUser.role) return false
    return u.parent?._id === currentUser._id
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  const workerCount = users.filter(u => u.role === 4).length
  const supervisorCount = users.filter(u => u.role === 3).length
  const engineerCount = users.filter(u => u.role === 2).length

  const summaryItems = isAdmin
    ? [
        { label: 'Engineers', value: String(engineerCount) },
        { label: 'Supervisors', value: String(supervisorCount) },
        { label: 'Workers', value: String(workerCount) },
      ]
    : [
        { label: 'Supervisors', value: String(supervisorCount) },
        { label: 'Workers', value: String(workerCount) },
      ]

  return (
    <PageLayout>
      <PageHeader title="Team Members" subtitle={`${users.length} members`}>
        <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </PageHeader>

      <SummaryBanner
        color="slate"
        icon={<UsersIcon className="h-8 w-8" />}
        items={summaryItems}
      />

      <SearchFilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name or email..."
      />

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            message="No team members found"
            action={
              <Button variant="outline" size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" /> Add First Member
              </Button>
            }
            icon={<UsersIcon className="h-12 w-12" />}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((u) => (
              <ListItem
                key={u._id}
                avatar={u.name}
                avatarColor={u.role === 2 ? 'blue' : u.role === 3 ? 'green' : 'amber'}
                title={u.name}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{u.email}</span>
                    {u.parent?.name && <span className="text-xs text-gray-400">• Reports to {u.parent.name}</span>}
                    {(u.role === 3 || u.role === 4) && u.dailyRate > 0 && (
                      <span className="text-xs text-green-600 font-medium">• ₹{u.dailyRate}/day</span>
                    )}
                  </div>
                }
                badge={{
                  label: u.isActive ? ROLE_NAMES[u.role] : `${ROLE_NAMES[u.role]} (Inactive)`,
                  className: u.isActive ? ROLE_COLORS[u.role] : 'bg-gray-100 text-gray-500',
                }}
                actions={
                  canManageUser(u) && (
                    <>
                      <ActionBtn
                        onClick={() => handleToggleActive(u._id, u.isActive)}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        icon={u.isActive ? UserX : UserCheck}
                        hoverClass={u.isActive ? 'hover:text-orange-600 hover:bg-orange-50' : 'hover:text-green-600 hover:bg-green-50'}
                      />
                      <ActionBtn onClick={() => openEdit(u)} title="Edit" icon={Edit} />
                      <ActionBtn
                        onClick={() => setDeleteId(u._id)}
                        title="Delete"
                        icon={Trash2}
                        hoverClass="hover:text-red-600 hover:bg-red-50"
                      />
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) { setEditingUser(null); resetForm() } }}>
        <SheetContent title={editingUser ? 'Edit Member' : 'Add New Member'}>
          <form onSubmit={editingUser ? handleEdit : handleAdd} className="px-5 py-4 space-y-4">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ramesh Patel"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ramesh@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
                required={!editingUser}
                minLength={6}
              />
            </div>

            {!editingUser && (
              <div className="space-y-1">
                <Label>Role / Position</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value })}
                  disabled={!isAdmin && !isSupervisor}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="2">Engineer</SelectItem>}
                    {(isAdmin || currentUser?.role === 2) && <SelectItem value="3">Supervisor</SelectItem>}
                    <SelectItem value="4">Worker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {((form.role === '3' || form.role === '4') && !editingUser) || (editingUser && (editingUser.role === 3 || editingUser.role === 4)) ? (
              <div className="space-y-1">
                <Label>Daily Pay Rate (₹)</Label>
                <Input
                  type="number"
                  value={form.dailyRate}
                  onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                  placeholder="e.g. 400"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-400">
                  Amount paid per working day
                  {form.dailyRate ? ` • Hourly: ₹${(parseFloat(form.dailyRate) / 8).toFixed(0)}/hr` : ''}
                </p>
              </div>
            ) : null}

            <Button type="submit" className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700">
              {editingUser ? 'Save Changes' : 'Add Member'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this team member. Their sub-members will be reassigned.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
