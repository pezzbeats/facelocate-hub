import { useMemo } from 'react';

export const usePerformanceOptimization = () => {
  // Debounce function for search inputs
  const debounce = useMemo(() => {
    return <T extends (...args: any[]) => any>(
      func: T,
      wait: number
    ): ((...args: Parameters<T>) => void) => {
      let timeout: NodeJS.Timeout;
      return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(null, args), wait);
      };
    };
  }, []);

  // Throttle function for scroll events
  const throttle = useMemo(() => {
    return <T extends (...args: any[]) => any>(
      func: T,
      limit: number
    ): ((...args: Parameters<T>) => void) => {
      let inThrottle: boolean;
      return (...args: Parameters<T>) => {
        if (!inThrottle) {
          func.apply(null, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    };
  }, []);

  // Memoized date formatter
  const formatDate = useMemo(() => {
    return (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      }).format(dateObj);
    };
  }, []);

  // Memoized time ago formatter
  const formatTimeAgo = useMemo(() => {
    return (timestamp: string) => {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now.getTime() - time.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return time.toLocaleDateString();
    };
  }, []);

  // Chunk array for pagination
  const chunkArray = useMemo(() => {
    return <T>(array: T[], chunkSize: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    };
  }, []);

  // Virtual scrolling helper
  const calculateVisibleItems = useMemo(() => {
    return (
      containerHeight: number,
      itemHeight: number,
      scrollTop: number,
      totalItems: number,
      overscan: number = 5
    ) => {
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
      
      return {
        startIndex,
        endIndex,
        visibleCount: endIndex - startIndex + 1,
        offsetY: startIndex * itemHeight
      };
    };
  }, []);

  return {
    debounce,
    throttle,
    formatDate,
    formatTimeAgo,
    chunkArray,
    calculateVisibleItems
  };
};

// Hook for optimized list rendering
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
) => {
  return useMemo(() => {
    const { usePerformanceOptimization } = require('./usePerformanceOptimization');
    const { calculateVisibleItems } = usePerformanceOptimization();
    
    const { startIndex, endIndex, offsetY } = calculateVisibleItems(
      containerHeight,
      itemHeight,
      scrollTop,
      items.length
    );
    
    const visibleItems = items.slice(startIndex, endIndex + 1);
    const totalHeight = items.length * itemHeight;
    
    return {
      visibleItems,
      startIndex,
      endIndex,
      offsetY,
      totalHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop]);
};

// Hook for optimized search
export const useOptimizedSearch = <T>(
  items: T[],
  searchTerm: string,
  searchKeys: (keyof T)[],
  debounceMs: number = 300
) => {
  const { debounce } = usePerformanceOptimization();
  
  return useMemo(() => {
    if (!searchTerm.trim()) return items;
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    return items.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key];
        return value && 
          String(value).toLowerCase().includes(normalizedSearch);
      })
    );
  }, [items, searchTerm, searchKeys]);
};