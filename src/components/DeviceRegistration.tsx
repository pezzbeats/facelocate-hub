import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, MapPin, Wifi, CheckCircle2 } from "lucide-react";

interface Location {
  id: string;
  location_name: string;
  location_code: string;
  address: string;
}

const DeviceRegistration = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    deviceName: "",
    locationId: "",
    deviceCode: ""
  });

  useEffect(() => {
    loadLocations();
    generateDeviceInfo();
    checkExistingRegistration();
  }, []);

  const generateDeviceInfo = () => {
    // Generate unique device fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    const deviceId = btoa(fingerprint).substring(0, 32);
    
    setDeviceInfo({
      deviceId,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    });
  };

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
        title: "Error Loading Locations",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const checkExistingRegistration = async () => {
    if (!deviceInfo?.deviceId) return;

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*, locations(location_name)')
        .eq('device_identifier', deviceInfo.deviceId)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setRegistered(true);
        setFormData({
          deviceName: data.device_name,
          locationId: data.location_id,
          deviceCode: data.device_code
        });
      }
    } catch (error) {
      // Device not registered yet
      console.log('Device not registered');
    }
  };

  const generateDeviceCode = async (locationId: string) => {
    try {
      // Get location code
      const { data: location } = await supabase
        .from('locations')
        .select('location_code')
        .eq('id', locationId)
        .maybeSingle();

      if (!location) return 'DEV001';

      // Get existing devices for this location
      const { data: devices } = await supabase
        .from('devices')
        .select('device_code')
        .like('device_code', `${location.location_code}-%`)
        .order('device_code', { ascending: false })
        .limit(1);

      if (!devices || devices.length === 0) {
        return `${location.location_code}-DEV01`;
      }

      const lastCode = devices[0].device_code;
      const lastNumber = parseInt(lastCode.split('-DEV')[1]);
      const nextNumber = lastNumber + 1;
      return `${location.location_code}-DEV${nextNumber.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('Error generating device code:', error);
      return 'DEV001';
    }
  };

  const handleLocationChange = async (locationId: string) => {
    setFormData(prev => ({ ...prev, locationId }));
    
    if (locationId) {
      const deviceCode = await generateDeviceCode(locationId);
      setFormData(prev => ({ ...prev, deviceCode }));
    }
  };

  const handleRegister = async () => {
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
      const { data, error } = await supabase.rpc('register_device', {
        device_name: formData.deviceName,
        device_code: formData.deviceCode,
        device_identifier: deviceInfo.deviceId,
        location_id: formData.locationId
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        setRegistered(true);
        toast({
          title: "Device Registered",
          description: result.message,
        });
      } else {
        throw new Error(result?.error || 'Registration failed');
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
          <CardTitle>Device Registered</CardTitle>
          <CardDescription>
            This device is registered and ready for use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Device Name:</span>
              <span>{formData.deviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Device Code:</span>
              <span>{formData.deviceCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Location:</span>
              <span>{locations.find(l => l.id === formData.locationId)?.location_name}</span>
            </div>
          </div>
          
          <Button 
            variant="kiosk" 
            size="lg" 
            className="w-full"
            onClick={() => window.location.href = '/kiosk'}
          >
            Launch Kiosk Interface
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Monitor className="h-12 w-12 text-primary mx-auto mb-4" />
        <CardTitle>Device Registration</CardTitle>
        <CardDescription>
          Register this device as a JusTrack kiosk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deviceName">Device Name *</Label>
          <Input
            id="deviceName"
            placeholder="e.g., Main Gate Kiosk"
            value={formData.deviceName}
            onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <Select value={formData.locationId} onValueChange={handleLocationChange} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(location => (
                <SelectItem key={location.id} value={location.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{location.location_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.deviceCode && (
          <div className="space-y-2">
            <Label>Generated Device Code</Label>
            <Input value={formData.deviceCode} disabled />
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <div className="font-medium">Device Information:</div>
          <div>Resolution: {deviceInfo?.screenResolution}</div>
          <div>Timezone: {deviceInfo?.timezone}</div>
          <div>ID: {deviceInfo?.deviceId?.substring(0, 8)}...</div>
        </div>

        <Button 
          onClick={handleRegister}
          disabled={loading || !formData.deviceName || !formData.locationId}
          size="lg"
          className="w-full"
        >
          {loading ? "Registering..." : "Register Device"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DeviceRegistration;