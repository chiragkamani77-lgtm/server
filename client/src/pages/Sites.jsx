import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { STATUS_COLORS } from '@/lib/utils'
import { Plus, Building, MapPin, Users, Trash2, Edit, Eye } from 'lucide-react'

export default function Sites() {
  const { isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editingSite, setEditingSite] = useState(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    name: '',
    address: '',
    description: '',
    status: 'active',
  })

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    try {
      const { data } = await sitesApi.getAll()
      setSites(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch sites',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await sitesApi.create(form)
      toast({ title: 'Site created successfully' })
      setIsAddOpen(false)
      setForm({ name: '', address: '', description: '', status: 'active' })
      fetchSites()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create site',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await sitesApi.update(editingSite._id, form)
      toast({ title: 'Site updated successfully' })
      setIsEditOpen(false)
      setEditingSite(null)
      setForm({ name: '', address: '', description: '', status: 'active' })
      fetchSites()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update site',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    try {
      await sitesApi.delete(deleteId)
      toast({ title: 'Site deleted successfully' })
      setDeleteId(null)
      fetchSites()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete site',
        variant: 'destructive',
      })
    }
  }

  const openEdit = (site) => {
    setEditingSite(site)
    setForm({
      name: site.name,
      address: site.address || '',
      description: site.description || '',
      status: site.status,
    })
    setIsEditOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sites</h1>
          <p className="text-muted-foreground">
            Manage your construction sites
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>Add New Site</DialogTitle>
                  <DialogDescription>
                    Create a new construction site
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Site Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Sunrise Apartments"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="123 Main Street, City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Residential complex - 20 units"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) => setForm({ ...form, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Site</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sites Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg font-medium mb-2">No sites found</p>
              {!isAdmin && (
                <div className="text-center max-w-md">
                  <p className="text-sm text-muted-foreground mb-2">
                    You haven't been assigned to any sites yet.
                  </p>
                  <p className="text-sm text-blue-600">
                    Contact your administrator to assign you to construction sites so you can manage expenses, track attendance, and allocate funds.
                  </p>
                </div>
              )}
              {isAdmin && (
                <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first site
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sites.map((site) => (
            <Card key={site._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{site.name}</CardTitle>
                  <Badge className={STATUS_COLORS[site.status]}>
                    {site.status.replace('_', ' ')}
                  </Badge>
                </div>
                {site.address && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {site.address}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {site.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {site.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="h-4 w-4" />
                  {site.assignedUsers?.length || 0} users assigned
                </div>

                {/* GST Bill Summary (for admins only) */}
                {isAdmin && site.gstSummary && site.gstSummary.totalBills > 0 && (
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <div className="text-xs font-semibold text-orange-900 mb-2">GST Bills Summary</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total GST:</span>
                        <span className="font-semibold ml-1">₹{site.gstSummary.totalGstAmount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bills:</span>
                        <span className="font-semibold ml-1">{site.gstSummary.totalBills}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pending:</span>
                        <span className="font-semibold ml-1 text-yellow-700">{site.gstSummary.pendingBills}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="font-semibold ml-1 text-green-700">{site.gstSummary.paidBills}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to={`/sites/${site._id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Link>
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(site)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(site._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit Site</DialogTitle>
              <DialogDescription>
                Update site details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Site Name</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this site and all associated expenses.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
