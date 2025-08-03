import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
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
    options?: {
      successMessage?: string;
      errorMessage?: string;
      showToast?: boolean;
    }
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await operation();
      setState({ data: result, loading: false, error: null });
      
      if (options?.showToast !== false && options?.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage
        });
      }
      
      return result;
    } catch (error: any) {
      const errorMessage = error.message || options?.errorMessage || 'Operation failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      
      if (options?.showToast !== false) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
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

// Hook for handling form submissions with error handling
export const useFormSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const submit = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await operation();
      
      if (options?.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage
        });
      }
      
      options?.onSuccess?.(result);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || options?.errorMessage || 'Submission failed';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      options?.onError?.(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, toast]);

  return {
    isSubmitting,
    submit
  };
};

// Hook for retry logic
export const useRetry = () => {
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const retry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        setRetryCount(0);
        return result;
      } catch (error: any) {
        lastError = error;
        setRetryCount(attempt);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    toast({
      title: "Operation Failed",
      description: `Failed after ${maxRetries} attempts: ${lastError.message}`,
      variant: "destructive"
    });
    
    throw lastError;
  }, [toast]);

  const reset = useCallback(() => {
    setRetryCount(0);
  }, []);

  return {
    retryCount,
    retry,
    reset
  };
};