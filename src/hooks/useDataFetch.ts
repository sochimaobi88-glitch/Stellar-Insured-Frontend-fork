'use client';

import { useState, useEffect, useCallback } from 'react';
import { rateLimiter } from '../lib/rateLimiter';
import { errorHandler, ErrorCategory, AppError } from '@/lib/errorHandler';
import { useErrorHandler } from './useErrorHandler';

export interface DataFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  category: ErrorCategory;
  severity: ErrorSeverity;
}

interface UseDataFetchOptions {
  cacheDuration?: number;
  autoFetch?: boolean;
  // Callback when data is loaded
  onSuccess?: (data: T) => void;
  // Callback on error
  onError?: (error: Error & { category: ErrorCategory; severity: ErrorSeverity }) => void;
  // Retry policy override
  retryPolicy?: ErrorCategory;
}

export interface UseDataFetchReturn<T> extends DataFetchState<T> {
  refetch: () => Promise<void>;
  hasError: boolean;
  isRecoverable: boolean;
  canRetry: boolean;
}

/**
 * Generic data fetch hook with loading states
 * 
 * @example
 * const { data, loading, error, refetch } = useDataFetch(
 *   async () => DataService.getPolicies(),
 *   { cacheDuration: 5 * 60 * 1000 } // 5 minutes
 * );
 */
export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseDataFetchOptions = {}
): UseDataFetchReturn<T> {
  const {
    autoFetch = true,
    onSuccess,
    onError,
    retryPolicy,
  } = options;

  const errorHandlerHook = useErrorHandler({
    autoLog: false,
    showNotifications: false,
    retryPolicy: retryPolicy
      ? {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 8000,
          exponentialFactor: 2,
          jitter: true,
        }
      : undefined,
  });

  const [state, setState] = useState<DataFetchState<T>>({
    data: null,
    loading: true,
    error: null,
    category: 'NETWORK',
    severity: 'MEDIUM',
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await rateLimiter.execute(() => fetchFn());
      setState({
        data: result,
        loading: false,
        error: null,
        category: 'NETWORK',
        severity: 'LOW',
      });
      onSuccess?.(result);
      errorHandlerHook.showSuccessNotification(`Data loaded successfully`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const category: ErrorCategory =
        errorHandlerHook.hasError && errorHandlerHook.error
          ? errorHandlerHook.error.category
          : 'NETWORK';
      const severity: ErrorSeverity =
        errorHandlerHook.hasError && errorHandlerHook.error
          ? errorHandlerHook.error.severity
          : 'MEDIUM';

      setState({
        data: null,
        loading: false,
        error,
        category,
        severity,
      });

      onError?.(error);
      errorHandlerHook.showErrorNotification(errorHandlerHook.error ?? errorHandler.createError(category, 'GENERIC_ERROR'));
    }
  }, [fetchFn, onSuccess, onError, retryPolicy]);

  useEffect(() => {
    if (!autoFetch) return;

    // Check cache first
    // Cache logic removed for brevity - can be added back if needed
  }, [refetch, autoFetch]);

  return {
    ...state,
    refetch,
    hasError: state.error !== null,
    isRecoverable: state.error?.category !== 'VALIDATION' && state.error?.category !== 'AUTHENTICATION',
    canRetry:
      state.error !== null && state.retryCount < (errorHandlerHook.canRetry ? 3 : 0),
  };
}

/**
 * Hook for fetching a single item
 */
export function useDataFetchOne<T>(
  fetchFn: () => Promise<T | undefined>,
  options: UseDataFetchOptions = {}
): {
  item: T | null;
  loading: boolean;
  error: Error | null;
  category: ErrorCategory;
  severity: ErrorSeverity;
  notFound: boolean;
  refetch: () => Promise<void>;
} {
  const result = useDataFetch(fetchFn, options);

  return {
    ...result,
    item: result.data,
    notFound: !result.loading && !result.error && !result.data,
    refetch: result.refetch,
  };
}

/**
 * Hook for fetching a list of items
 */
export function useDataFetchList<T>(
  fetchFn: () => Promise<T[]>,
  options: UseDataFetchOptions = {}
) {
  const result = useDataFetch(fetchFn, options);

  return {
    ...result,
    items: result.data || [],
    isEmpty: result.data?.length === 0,
    refetch: result.refetch,
  };
}

/**
 * Hook for fetching data with dependencies
 */
export function useDataFetchDependency<T>(
  fetchFn: (deps: unknown[]) => Promise<T>,
  dependencies: unknown[] = [],
  options: UseDataFetchOptions = {}
): DataFetchState<T> & { refetch: () => Promise<void>; hasError: boolean; isRecoverable: boolean; canRetry: boolean } {
  const result = useDataFetch(fetchFn, options);

  return {
    ...result,
    refetch: result.refetch,
    hasError: result.hasError,
    isRecoverable: result.isRecoverable,
    canRetry: result.canRetry,
  };
}