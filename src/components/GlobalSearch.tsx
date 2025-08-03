import { useState, useCallback, useEffect } from "react";
import { Search, User, MapPin, Monitor, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  id: string;
  type: "employee" | "location" | "device";
  title: string;
  subtitle: string;
  status?: string;
}

interface GlobalSearchProps {
  onResultSelect?: (result: SearchResult) => void;
}

const GlobalSearch = ({ onResultSelect }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);

  const searchData = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, employee_code, department, is_active')
        .or(`full_name.ilike.%${searchQuery}%,employee_code.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(5);

      if (employees) {
        employees.forEach(emp => {
          searchResults.push({
            id: emp.id,
            type: "employee",
            title: emp.full_name,
            subtitle: `${emp.employee_code} • ${emp.department}`,
            status: emp.is_active ? "active" : "inactive"
          });
        });
      }

      // Search locations
      const { data: locations } = await supabase
        .from('locations')
        .select('id, location_name, location_code, address, is_active')
        .or(`location_name.ilike.%${searchQuery}%,location_code.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(5);

      if (locations) {
        locations.forEach(loc => {
          searchResults.push({
            id: loc.id,
            type: "location",
            title: loc.location_name,
            subtitle: `${loc.location_code} • ${loc.address || 'No address'}`,
            status: loc.is_active ? "active" : "inactive"
          });
        });
      }

      // Search devices
      const { data: devices } = await supabase
        .from('devices')
        .select(`
          id, 
          device_name, 
          device_code, 
          is_active, 
          is_online,
          locations!inner(location_name)
        `)
        .or(`device_name.ilike.%${searchQuery}%,device_code.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(5);

      if (devices) {
        devices.forEach(device => {
          searchResults.push({
            id: device.id,
            type: "device", 
            title: device.device_name,
            subtitle: `${device.device_code} • ${device.locations?.location_name}`,
            status: device.is_online ? "online" : "offline"
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchData(debouncedQuery);
  }, [debouncedQuery, searchData]);

  const getIcon = (type: string) => {
    switch (type) {
      case "employee": return User;
      case "location": return MapPin;
      case "device": return Monitor;
      default: return Search;
    }
  };

  const getStatusBadge = (type: string, status?: string) => {
    if (!status) return null;
    
    const variants = {
      active: "default",
      inactive: "secondary", 
      online: "default",
      offline: "destructive"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"} className="text-xs">
        {status}
      </Badge>
    );
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    onResultSelect?.(result);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full max-w-sm justify-start text-muted-foreground bg-background/50 hover:bg-background border-border/50"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Search employees, locations, devices...</span>
        <span className="sm:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search employees, locations, devices..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}
          
          {!loading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found for "{query}"</CommandEmpty>
          )}

          {!loading && results.length > 0 && (
            <>
              {["employee", "location", "device"].map(type => {
                const typeResults = results.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <CommandGroup key={type} heading={`${type.charAt(0).toUpperCase() + type.slice(1)}s`}>
                    {typeResults.map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 py-3"
                        >
                          <Icon className="h-4 w-4" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                          </div>
                          {getStatusBadge(result.type, result.status)}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default GlobalSearch;