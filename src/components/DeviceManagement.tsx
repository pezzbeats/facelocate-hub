import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Wifi, WifiOff, Camera, CameraOff, MapPin, Clock } from "lucide-react";

interface Device {
  id: string;
  device_name: string;
  device_code: string;
  device_identifier: string;
  location_id: string;
  is_active: boolean;
  created_at: string;
  locations: {
    location_name: string;
    location_code: string;
  };
  latest_heartbeat?: {
    status: string;
    camera_status: string;
    network_status: string;
    timestamp: string;
  };
}

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDevices();
    
    // Set up real-time subscription for device heartbeats
    const channel = supabase
      .channel('device_heartbeats')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'device_heartbeats' },
        () => {
          loadDevices(); // Reload devices when heartbeat changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select(`
          *,
          locations (
            location_name,
            location_code
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get latest heartbeat for each device
      const devicesWithHeartbeat = await Promise.all(
        (data || []).map(async (device) => {
          const { data: heartbeat } = await supabase
            .from('device_heartbeats')
            .select('status, camera_status, network_status, timestamp')
            .eq('device_id', device.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...device,
            latest_heartbeat: heartbeat
          };
        })
      );
      
      setDevices(devicesWithHeartbeat);
    } catch (error: any) {
      toast({
        title: "Error Loading Devices",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateDevice = async (device: Device) => {
    if (!confirm(`Are you sure you want to deactivate ${device.device_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('devices')
        .update({ is_active: false })
        .eq('id', device.id);

      if (error) throw error;

      toast({
        title: "Device Deactivated",
        description: "Device has been deactivated successfully.",
      });

      loadDevices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getDeviceStatusBadge = (device: Device) => {
    if (!device.is_active) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    
    if (!device.latest_heartbeat) {
      return <Badge variant="secondary">No Signal</Badge>;
    }

    const heartbeatTime = new Date(device.latest_heartbeat.timestamp);
    const now = new Date();
    const minutesAgo = (now.getTime() - heartbeatTime.getTime()) / (1000 * 60);

    if (minutesAgo > 5) {
      return <Badge variant="destructive">Offline</Badge>;
    } else if (device.latest_heartbeat.status === 'online') {
      return <Badge variant="default">Online</Badge>;
    } else {
      return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getCameraStatusIcon = (device: Device) => {
    if (!device.latest_heartbeat) {
      return <CameraOff className="h-4 w-4 text-muted-foreground" />;
    }

    return device.latest_heartbeat.camera_status === 'working' ? (
      <Camera className="h-4 w-4 text-green-600" />
    ) : (
      <CameraOff className="h-4 w-4 text-red-600" />
    );
  };

  const getNetworkStatusIcon = (device: Device) => {
    if (!device.latest_heartbeat) {
      return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }

    return device.latest_heartbeat.network_status === 'connected' ? (
      <Wifi className="h-4 w-4 text-green-600" />
    ) : (
      <WifiOff className="h-4 w-4 text-red-600" />
    );
  };

  const onlineDevices = devices.filter(d => d.is_active && d.latest_heartbeat?.status === 'online');
  const offlineDevices = devices.filter(d => d.is_active && (!d.latest_heartbeat || d.latest_heartbeat.status !== 'online'));
  const workingCameras = devices.filter(d => d.latest_heartbeat?.camera_status === 'working');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Device Management</h2>
          <p className="text-muted-foreground">Monitor and manage kiosk devices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDevices}>
            Refresh Status
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Monitor className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{devices.length}</p>
                <p className="text-sm text-muted-foreground">Total Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wifi className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{onlineDevices.length}</p>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <WifiOff className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{offlineDevices.length}</p>
                <p className="text-sm text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Camera className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{workingCameras.length}</p>
                <p className="text-sm text-muted-foreground">Camera OK</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
          <CardDescription>Real-time status of all registered devices</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.device_code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{device.device_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {device.device_identifier.substring(0, 8)}...
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{device.locations.location_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getDeviceStatusBadge(device)}</TableCell>
                  <TableCell>{getCameraStatusIcon(device)}</TableCell>
                  <TableCell>{getNetworkStatusIcon(device)}</TableCell>
                  <TableCell>
                    {device.latest_heartbeat ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {new Date(device.latest_heartbeat.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivateDevice(device)}
                      disabled={!device.is_active}
                    >
                      Deactivate
                    </Button>
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

export default DeviceManagement;