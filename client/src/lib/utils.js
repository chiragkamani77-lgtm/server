import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export const ROLE_NAMES = {
  1: 'Developer',
  2: 'Engineer',
  3: 'Supervisor'
}

export const ROLE_COLORS = {
  1: 'bg-purple-100 text-purple-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800'
}

export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  on_hold: 'bg-yellow-100 text-yellow-800'
}
