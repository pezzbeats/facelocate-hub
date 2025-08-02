import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Monitor, MapPin, Fingerprint } from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

interface Location {
  id: string;
  location_name: string;
  location_code: string;
  description: string;
}

const KioskRegister = () => {
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [formData, setFormData] = useState({
    deviceName: "",
    deviceCode: "",
    locationId: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadLocations();
    generateDeviceCode();
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('location_name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load locations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingLocations(false);
    }
  };

  const generateDeviceCode = () => {
    // Generate a unique device code
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    setFormData(prev => ({
      ...prev,
      deviceCode: `KIOSK-${timestamp}${random}`
    }));
  };

  const generateDeviceIdentifier = () => {
    // Create a unique device identifier based on browser fingerprint
    const navigator_info = navigator.userAgent + navigator.language + screen.width + screen.height;
    const device_id = btoa(navigator_info).replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
    return device_id;
  };

  const handleRegisterDevice = async () => {
    if (!formData.deviceName || !formData.locationId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const deviceIdentifier = generateDeviceIdentifier();
      
      // Call the database function to register device
      const { data, error } = await supabase.rpc('register_device', {
        device_name: formData.deviceName,
        device_code: formData.deviceCode,
        device_identifier: deviceIdentifier,
        location_id: formData.locationId
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        // Store device info locally
        localStorage.setItem('justrack_device_id', result.device_id);
        localStorage.setItem('justrack_device_name', formData.deviceName);
        localStorage.setItem('justrack_device_code', formData.deviceCode);
        localStorage.setItem('justrack_device_identifier', deviceIdentifier);
        localStorage.setItem('justrack_location_id', formData.locationId);
        
        // Get location name for storage
        const selectedLocation = locations.find(loc => loc.id === formData.locationId);
        if (selectedLocation) {
          localStorage.setItem('justrack_device_location', selectedLocation.location_name);
        }

        toast({
          title: "Device Registered Successfully!",
          description: result.message,
        });

        // Navigate to kiosk interface
        setTimeout(() => {
          navigate('/kiosk');
        }, 1500);
      } else {
        throw new Error(result?.error || 'Registration failed');
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register device. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingLocations) {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-kiosk">
        <CardHeader className="text-center">
          <img src={jusTrackLogo} alt="JusTrack" className="h-12 w-auto mx-auto mb-4" />
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Device Registration</CardTitle>
          <CardDescription>
            Register this kiosk device to a specific location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deviceName">Device Name</Label>
            <Input
              id="deviceName"
              type="text"
              placeholder="e.g., Main Gate Kiosk"
              value={formData.deviceName}
              onChange={(e) => handleInputChange('deviceName', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deviceCode">Device Code</Label>
            <div className="flex gap-2">
              <Input
                id="deviceCode"
                type="text"
                value={formData.deviceCode}
                readOnly
                className="bg-muted"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={generateDeviceCode}
                disabled={loading}
              >
                <Fingerprint className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-generated unique identifier for this device
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.locationId}
              onValueChange={(value) => handleInputChange('locationId', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{location.location_name}</div>
                        <div className="text-xs text-muted-foreground">{location.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {locations.length === 0 && (
              <p className="text-sm text-destructive">
                No locations available. Please contact your administrator.
              </p>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <h4 className="font-medium mb-2">Device Information:</h4>
            <div className="space-y-1 text-muted-foreground">
              <p>• This device will be permanently registered to the selected location</p>
              <p>• Only authorized personnel should register devices</p>
              <p>• Registration requires admin approval in some cases</p>
            </div>
          </div>

          <Button 
            variant="kiosk" 
            size="kiosk" 
            className="w-full" 
            onClick={handleRegisterDevice}
            disabled={loading || !formData.deviceName || !formData.locationId || locations.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register Device
          </Button>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="lg" 
              className="flex-1"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="flex-1"
              onClick={() => navigate('/kiosk')}
              disabled={loading}
            >
              Skip Registration
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by Shatak Infotech</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KioskRegister;