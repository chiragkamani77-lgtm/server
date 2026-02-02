import { useState, useCallback } from 'react'

/**
 * Custom hook for managing loading states for CRUD operations
 * @returns {Object} - Loading states and handlers
 */
export function useLoading() {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Wrapper for async operations with loading state
  const withLoading = useCallback(async (operation, loadingType = 'loading') => {
    const setLoadingState = {
      creating: setCreating,
      updating: setUpdating,
      deleting: setDeleting,
      loading: setLoading
    }[loadingType]

    if (!setLoadingState) {
      throw new Error(`Invalid loading type: ${loadingType}`)
    }

    setLoadingState(true)
    try {
      const result = await operation()
      return result
    } finally {
      setLoadingState(false)
    }
  }, [])

  // Individual operation wrappers
  const withCreating = useCallback((operation) => withLoading(operation, 'creating'), [withLoading])
  const withUpdating = useCallback((operation) => withLoading(operation, 'updating'), [withLoading])
  const withDeleting = useCallback((operation) => withLoading(operation, 'deleting'), [withLoading])
  const withGeneralLoading = useCallback((operation) => withLoading(operation, 'loading'), [withLoading])

  return {
    creating,
    updating,
    deleting,
    loading,
    setCreating,
    setUpdating,
    setDeleting,
    setLoading,
    withCreating,
    withUpdating,
    withDeleting,
    withLoading: withGeneralLoading,
    isAnyLoading: creating || updating || deleting || loading
  }
}
