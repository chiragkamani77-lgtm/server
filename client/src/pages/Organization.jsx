import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { organizationsApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Building2, Edit, Users, UserPlus, Trash2, Mail, Phone, MapPin, FileText } from 'lucide-react'

export default function Organization() {
  const { isAdmin, user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [partners, setPartners] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)
  const [removePartnerId, setRemovePartnerId] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const { toast } = useToast()

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
  })

  useEffect(() => {
    fetchOrganization()
  }, [])

  const fetchOrganization = async () => {
    try {
      setLoading(true)
      const { data } = await organizationsApi.getCurrent()
      setOrganization(data)
      fetchPartners(data._id)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch organization',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPartners = async (orgId) => {
    try {
      const { data } = await organizationsApi.getPartners(orgId)
      setPartners(data)
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const { data } = await usersApi.getAll()
      // Filter users who are Level 1 and don't have an organization
      const available = data.filter(u => u.role === 1 && !u.organization)
      setAvailableUsers(available)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const openEdit = () => {
    setForm({
      name: organization.name || '',
      description: organization.description || '',
      address: organization.address || '',
      phone: organization.phone || '',
      email: organization.email || '',
      gstNumber: organization.gstNumber || '',
    })
    setIsEditOpen(true)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await organizationsApi.update(organization._id, form)
      toast({ title: 'Organization updated successfully' })
      setIsEditOpen(false)
      fetchOrganization()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update organization',
        variant: 'destructive',
      })
    }
  }

  const openAddPartner = () => {
    fetchAvailableUsers()
    setSelectedUserId('')
    setIsAddPartnerOpen(true)
  }

  const handleAddPartner = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      })
      return
    }

    try {
      await organizationsApi.addPartner(organization._id, selectedUserId)
      toast({ title: 'Partner added successfully' })
      setIsAddPartnerOpen(false)
      setSelectedUserId('')
      fetchPartners(organization._id)
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add partner',
        variant: 'destructive',
      })
    }
  }

  const handleRemovePartner = async () => {
    try {
      await organizationsApi.removePartner(organization._id, removePartnerId)
      toast({ title: 'Partner removed successfully' })
      setRemovePartnerId(null)
      fetchPartners(organization._id)
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove partner',
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

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No organization found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organization</h1>
          <p className="text-muted-foreground">
            Manage your organization details and partners
          </p>
        </div>
      </div>

      {/* Organization Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{organization.name}</CardTitle>
                {organization.description && (
                  <CardDescription>{organization.description}</CardDescription>
                )}
              </div>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {organization.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{organization.email}</span>
              </div>
            )}
            {organization.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{organization.phone}</span>
              </div>
            )}
            {organization.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{organization.address}</span>
              </div>
            )}
            {organization.gstNumber && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>GST: {organization.gstNumber}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Partners Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Partners</CardTitle>
                <CardDescription>
                  Organization owners and partners
                </CardDescription>
              </div>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={openAddPartner}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No partners found</p>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <div
                  key={partner._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{partner.name}</p>
                    <p className="text-sm text-muted-foreground">{partner.email}</p>
                  </div>
                  {isAdmin && partner._id !== user?._id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemovePartnerId(partner._id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update your organization details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Organization name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="info@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={form.gstNumber}
                  onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                  placeholder="29ABCDE1234F1Z5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Office address"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Partner Dialog */}
      <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
            <DialogDescription>
              Add a new partner to your organization. Only Level 1 users without an organization can be added.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="partner">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No available users
                    </SelectItem>
                  ) : (
                    availableUsers.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPartnerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner} disabled={!selectedUserId}>
              Add Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Partner Confirmation */}
      <AlertDialog open={!!removePartnerId} onOpenChange={() => setRemovePartnerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the partner from your organization. They will no longer have access to organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePartner} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
