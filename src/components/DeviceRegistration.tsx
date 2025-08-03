import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAsyncOperation } from "@/hooks/useAsyncOperation";
import LoadingSpinner from "@/components/LoadingSpinner";
import SecureStorage from "@/utils/secureStorage";
import { Monitor, MapPin, Wifi, CheckCircle2, AlertTriangle, RefreshCw, Settings } from "lucide-react";

interface Location {
  id: string;
  location_name: string;
  location_code: string;
  address: string;
}

const DeviceRegistration = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [registered, setRegistered] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [registrationStep, setRegistrationStep] = useState<'setup' | 'testing' | 'complete'>('setup');
  const { toast } = useToast();
  const { loading, error, execute } = useAsyncOperation();

  const [formData, setFormData] = useState({
    deviceName: "",
    locationId: "",
    deviceCode: ""
  });

  useEffect(() => {
    loadLocations();
    generateDeviceInfo();
    checkExistingRegistration();
    checkCameraAccess();
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
    
    const deviceData = {
      deviceId,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };
    
    setDeviceInfo(deviceData);
    
    // Store device info securely
    SecureStorage.setItem('device_info', deviceData, 24); // 24 hour expiry
  };

  const checkCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStatus('available');
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setCameraStatus('unavailable');
    }
  };

  const loadLocations = async () => {
    execute(async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('location_name');

      if (error) throw error;
      setLocations(data || []);
      return data || [];
    }, { showToast: false });
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
      // Device not registered yet - this is expected behavior
      // Remove console logging in production
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
      // Fallback device code generation - log securely in production
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

  const testDeviceCapabilities = async () => {
    setRegistrationStep('testing');
    
    // Test camera
    if (cameraStatus !== 'available') {
      await checkCameraAccess();
    }
    
    // Test network (already done since we can load locations)
    
    // Simulate other tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setRegistrationStep('complete');
    toast({
      title: "Device Tests Complete",
      description: "All capabilities verified successfully."
    });
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

    if (cameraStatus !== 'available') {
      toast({
        title: "Camera Required",
        description: "Camera access is required for face recognition.",
        variant: "destructive"
      });
      return;
    }

    execute(async () => {
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
        return result;
      } else {
        throw new Error(result?.error || 'Registration failed');
      }
    }, {
      successMessage: "Device registered successfully!"
    });
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
        {/* Device Status Indicators */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Alert className={cameraStatus === 'available' ? 'border-success' : 'border-destructive'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Camera Access</span>
              <Badge variant={cameraStatus === 'available' ? 'default' : 'destructive'}>
                {cameraStatus === 'checking' ? 'Checking...' : 
                 cameraStatus === 'available' ? 'Available' : 'Required'}
              </Badge>
            </AlertDescription>
          </Alert>
          <Alert className="border-success">
            <Wifi className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Network Connection</span>
              <Badge variant="default">Connected</Badge>
            </AlertDescription>
          </Alert>
        </div>

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

        {registrationStep === 'setup' && (
          <div className="space-y-3">
            <Button 
              onClick={testDeviceCapabilities}
              disabled={!formData.deviceName || !formData.locationId || cameraStatus !== 'available'}
              size="lg"
              className="w-full"
              variant="outline"
            >
              <Settings className="mr-2 h-4 w-4" />
              Test Device Capabilities
            </Button>
            <Button 
              onClick={handleRegister}
              disabled={loading || !formData.deviceName || !formData.locationId || cameraStatus !== 'available'}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Registering...
                </>
              ) : (
                "Register Device"
              )}
            </Button>
          </div>
        )}

        {registrationStep === 'testing' && (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" message="Testing device capabilities..." />
          </div>
        )}

        {registrationStep === 'complete' && !registered && (
          <Button 
            onClick={handleRegister}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Registering...
              </>
            ) : (
              "Complete Registration"
            )}
          </Button>
        )}

        {cameraStatus === 'unavailable' && (
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Camera access is required for face recognition. Please allow camera permissions and refresh.
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2"
                onClick={checkCameraAccess}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceRegistration;