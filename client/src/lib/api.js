import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken })
}

// Sites API
export const sitesApi = {
  getAll: () => api.get('/sites'),
  getOne: (id) => api.get(`/sites/${id}`),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.put(`/sites/${id}`, data),
  delete: (id) => api.delete(`/sites/${id}`),
  assign: (siteId, userId) => api.post(`/sites/${siteId}/assign`, { userId }),
  unassign: (siteId, userId) => api.delete(`/sites/${siteId}/assign/${userId}`),
  getUsers: (siteId) => api.get(`/sites/${siteId}/users`)
}

// Expenses API
export const expensesApi = {
  getAll: (params) => api.get('/expenses', { params }),
  getOne: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getSummary: (siteId) => api.get(`/expenses/summary/${siteId}`),
  uploadReceipt: (id, file) => {
    const formData = new FormData()
    formData.append('receipt', file)
    return api.post(`/expenses/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getChildren: () => api.get('/users/my/children')
}

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
}

// Reports API
export const reportsApi = {
  getSiteReport: (siteId, params) => api.get(`/reports/site/${siteId}`, { params }),
  downloadPdf: (siteId, params) => api.get(`/reports/site/${siteId}/pdf`, {
    params,
    responseType: 'blob'
  }),
  downloadExcel: (siteId, params) => api.get(`/reports/site/${siteId}/excel`, {
    params,
    responseType: 'blob'
  }),
  getSummary: () => api.get('/reports/summary')
}

// Organizations API
export const organizationsApi = {
  getCurrent: () => api.get('/organizations/current'),
  getAll: () => api.get('/organizations'),
  getOne: (id) => api.get(`/organizations/${id}`),
  create: (data) => api.post('/organizations', data),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  getPartners: (id) => api.get(`/organizations/${id}/partners`),
  addPartner: (id, userId) => api.post(`/organizations/${id}/partners`, { userId }),
  removePartner: (id, userId) => api.delete(`/organizations/${id}/partners/${userId}`),
  getSummary: (id) => api.get(`/organizations/${id}/summary`)
}

// Investments API
export const investmentsApi = {
  getAll: (params) => api.get('/investments', { params }),
  getOne: (id) => api.get(`/investments/${id}`),
  create: (data) => api.post('/investments', data),
  update: (id, data) => api.put(`/investments/${id}`, data),
  delete: (id) => api.delete(`/investments/${id}`),
  getSummary: () => api.get('/investments/summary')
}

// Fund Allocations API
export const fundsApi = {
  getAll: (params) => api.get('/funds', { params }),
  getOne: (id) => api.get(`/funds/${id}`),
  create: (data) => api.post('/funds', data),
  updateStatus: (id, status) => api.put(`/funds/${id}/status`, { status }),
  delete: (id) => api.delete(`/funds/${id}`),
  getMySummary: () => api.get('/funds/my-summary')
}

// Bills API
export const billsApi = {
  getAll: (params) => api.get('/bills', { params }),
  getOne: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  updateStatus: (id, status) => api.put(`/bills/${id}/status`, { status }),
  delete: (id) => api.delete(`/bills/${id}`),
  getSummary: () => api.get('/bills/summary'),
  uploadReceipt: (id, file) => {
    const formData = new FormData()
    formData.append('receipt', file)
    return api.post(`/bills/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// Attendance API
export const attendanceApi = {
  getAll: (params) => api.get('/attendance', { params }),
  create: (data) => api.post('/attendance', data),
  bulkCreate: (data) => api.post('/attendance/bulk', data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  delete: (id) => api.delete(`/attendance/${id}`),
  getSummary: (workerId, params) => api.get(`/attendance/summary/${workerId}`, { params })
}

// Worker Ledger API
export const ledgerApi = {
  getAll: (params) => api.get('/ledger', { params }),
  getOne: (id) => api.get(`/ledger/${id}`),
  create: (data) => api.post('/ledger', data),
  update: (id, data) => api.put(`/ledger/${id}`, data),
  delete: (id) => api.delete(`/ledger/${id}`),
  getBalance: (workerId) => api.get(`/ledger/balance/${workerId}`)
}

export default api
