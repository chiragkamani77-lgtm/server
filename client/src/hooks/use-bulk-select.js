import { useState, useCallback } from 'react'

/**
 * Custom hook for bulk selection and deletion
 * @param {Array} items - Array of items (with _id property)
 * @param {Function} deleteApi - API function to delete items (takes array of IDs)
 * @param {Function} onSuccess - Callback after successful deletion
 * @param {Function} onError - Callback after error
 * @returns {Object} - Selection state and handlers
 */
export function useBulkSelect(items = [], deleteApi, onSuccess, onError) {
  const [selected, setSelected] = useState([])
  const [deleting, setDeleting] = useState(false)

  // Toggle single item selection
  const toggleSelect = useCallback((id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    )
  }, [])

  // Toggle all items selection
  const toggleSelectAll = useCallback(() => {
    if (selected.length === items.length && items.length > 0) {
      setSelected([])
    } else {
      setSelected(items.map(item => item._id))
    }
  }, [items, selected.length])

  // Check if item is selected
  const isSelected = useCallback((id) => {
    return selected.includes(id)
  }, [selected])

  // Check if all items are selected
  const isAllSelected = useCallback(() => {
    return items.length > 0 && selected.length === items.length
  }, [items.length, selected.length])

  // Check if some (but not all) items are selected
  const isIndeterminate = useCallback(() => {
    return selected.length > 0 && selected.length < items.length
  }, [items.length, selected.length])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelected([])
  }, [])

  // Delete selected items
  const deleteSelected = useCallback(async () => {
    if (selected.length === 0) return

    setDeleting(true)
    try {
      await deleteApi(selected)
      setSelected([])
      if (onSuccess) onSuccess(selected.length)
    } catch (error) {
      if (onError) onError(error)
    } finally {
      setDeleting(false)
    }
  }, [selected, deleteApi, onSuccess, onError])

  return {
    selected,
    deleting,
    toggleSelect,
    toggleSelectAll,
    isSelected,
    isAllSelected,
    isIndeterminate,
    clearSelection,
    deleteSelected,
    selectedCount: selected.length
  }
}
