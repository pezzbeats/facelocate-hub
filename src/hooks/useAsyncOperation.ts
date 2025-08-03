import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface AsyncOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export const useAsyncOperation = <T>() => {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null
  });
  const { toast } = useToast();

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options: AsyncOptions = {}
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await operation();
      setState({ data: result, loading: false, error: null });
      
      if (options.showToast !== false && options.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage
        });
      }
      
      options.onSuccess?.(result);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || options.errorMessage || 'Operation failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      
      if (options.showToast !== false) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      options.onError?.(error);
      throw error;
    }
  }, [toast]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
};