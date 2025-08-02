import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Edit, Trash2, MapPin, Monitor } from "lucide-react";

interface Location {
  id: string;
  location_name: string;
  location_code: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters?: number;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  device_count?: number;
}

const LocationManagement = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    location_name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius_meters: "50",
    working_hours_start: "09:00",
    working_hours_end: "18:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      // Query locations with device count
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (locationsError) throw locationsError;

      // Get device counts for each location
      const locationsWithDeviceCount = await Promise.all(
        (locationsData || []).map(async (location) => {
          const { count } = await supabase
            .from('devices')
            .select('*', { count: 'exact', head: true })
            .eq('location_id', location.id)
            .eq('is_active', true);

          return {
            ...location,
            device_count: count || 0
          };
        })
      );
      
      setLocations(locationsWithDeviceCount);
    } catch (error: any) {
      toast({
        title: "Error Loading Locations",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLocationCode = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('location_code')
      .order('location_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error generating location code:', error);
      return 'LOC001';
    }

    if (!data || data.length === 0) {
      return 'LOC001';
    }

    const lastCode = data[0].location_code;
    const lastNumber = parseInt(lastCode.replace('LOC', ''));
    const nextNumber = lastNumber + 1;
    return `LOC${nextNumber.toString().padStart(3, '0')}`;
  };

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      setFormData(prev => ({
        ...prev,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      }));

      toast({
        title: "Location Retrieved",
        description: "GPS coordinates have been set automatically.",
      });
    } catch (error: any) {
      toast({
        title: "Location Error",
        description: "Could not get current location. Please enter coordinates manually.",
        variant: "destructive"
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const locationData = {
        location_name: formData.location_name,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        radius_meters: parseInt(formData.radius_meters) || 50,
        working_hours_start: formData.working_hours_start,
        working_hours_end: formData.working_hours_end,
        timezone: formData.timezone
      };

      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', editingLocation.id);

        if (error) throw error;

        toast({
          title: "Location Updated",
          description: "Location information has been updated successfully.",
        });
      } else {
        // Create new location
        const locationCode = await generateLocationCode();
        
        const { error } = await supabase
          .from('locations')
          .insert({
            ...locationData,
            location_code: locationCode
          });

        if (error) throw error;

        toast({
          title: "Location Added",
          description: `Location ${locationCode} has been added successfully.`,
        });
      }

      // Reset form and reload data
      setFormData({
        location_name: "",
        address: "",
        latitude: "",
        longitude: "",
        radius_meters: "50",
        working_hours_start: "09:00",
        working_hours_end: "18:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      setShowAddDialog(false);
      setEditingLocation(null);
      loadLocations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      location_name: location.location_name,
      address: location.address,
      latitude: location.latitude?.toString() || "",
      longitude: location.longitude?.toString() || "",
      radius_meters: (location.radius_meters || 50).toString(),
      working_hours_start: location.working_hours_start || "09:00",
      working_hours_end: location.working_hours_end || "18:00",
      timezone: location.timezone
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (location: Location) => {
    if (!confirm(`Are you sure you want to delete ${location.location_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: "Location Deleted",
        description: "Location has been deactivated successfully.",
      });

      loadLocations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredLocations = locations.filter(location =>
    location.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.location_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Location Management</h2>
          <p className="text-muted-foreground">Manage office locations and attendance points</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingLocation(null);
              setFormData({
                location_name: "",
                address: "",
                latitude: "",
                longitude: "",
                radius_meters: "50",
                working_hours_start: "09:00",
                working_hours_end: "18:00",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
              });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </DialogTitle>
              <DialogDescription>
                {editingLocation ? 'Update location information' : 'Enter location details to add a new attendance point'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location_name">Location Name *</Label>
                <Input
                  id="location_name"
                  placeholder="e.g., Main Office, Warehouse"
                  value={formData.location_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  placeholder="Full address of the location"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 40.7128"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="e.g., -74.0060"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="flex-1"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {gettingLocation ? "Getting Location..." : "Use Current Location"}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="radius_meters">Attendance Radius (meters)</Label>
                <Input
                  id="radius_meters"
                  type="number"
                  min="10"
                  max="1000"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius_meters: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Employees must be within this radius to clock in/out
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="working_hours_start">Start Time</Label>
                  <Input
                    id="working_hours_start"
                    type="time"
                    value={formData.working_hours_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, working_hours_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="working_hours_end">End Time</Label>
                  <Input
                    id="working_hours_end"
                    type="time"
                    value={formData.working_hours_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, working_hours_end: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  placeholder="e.g., America/New_York"
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {editingLocation ? 'Update Location' : 'Add Location'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Working Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.location_code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{location.location_name}</div>
                      {location.latitude && location.longitude && (
                        <div className="text-sm text-muted-foreground">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{location.address}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Monitor className="h-4 w-4" />
                      <span>{location.device_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {location.working_hours_start && location.working_hours_end ? (
                      <span className="text-sm">
                        {location.working_hours_start} - {location.working_hours_end}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? "default" : "destructive"}>
                      {location.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(location)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(location)}
                        disabled={!location.is_active}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationManagement;