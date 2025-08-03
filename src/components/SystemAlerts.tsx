import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Wifi, 
  WifiOff, 
  Camera, 
  CameraOff,
  Database,
  Users,
  Activity,
  Loader2
} from "lucide-react";

interface DeviceStatus {
  id: string;
  device_name: string;
  device_code: string;
  is_online: boolean;
  last_heartbeat: string | null;
  location_name: string;
  camera_status: string;
  cpu_usage: number;
  memory_usage: number;
}

interface SystemAlert {
  id: string;
  type: 'device_offline' | 'camera_error' | 'high_cpu' | 'high_memory' | 'database_error' | 'auth_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  device_id?: string;
  device_name?: string;
  location_name?: string;
  timestamp: string;
  resolved: boolean;
}

const SystemAlerts = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      
      // Load device status
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select(`
          id,
          device_name,
          device_code,
          is_online,
          last_heartbeat,
          locations!inner(location_name)
        `)
        .eq('is_active', true);

      if (deviceError) throw deviceError;

      // Load latest heartbeats
      const { data: heartbeatData, error: heartbeatError } = await supabase
        .from('device_heartbeats')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (heartbeatError) throw heartbeatError;

      // Process device status and generate alerts
      const processedDevices: DeviceStatus[] = [];
      const generatedAlerts: SystemAlert[] = [];

      deviceData?.forEach((device: any) => {
        const latestHeartbeat = heartbeatData?.find(h => h.device_id === device.id);
        
        const deviceStatus: DeviceStatus = {
          id: device.id,
          device_name: device.device_name,
          device_code: device.device_code,
          is_online: device.is_online,
          last_heartbeat: device.last_heartbeat,
          location_name: device.locations.location_name,
          camera_status: latestHeartbeat?.camera_status || 'unknown',
          cpu_usage: latestHeartbeat?.cpu_usage || 0,
          memory_usage: latestHeartbeat?.memory_usage || 0
        };

        processedDevices.push(deviceStatus);

        // Generate alerts based on device status
        const now = new Date();
        const lastSeen = device.last_heartbeat ? new Date(device.last_heartbeat) : null;
        const offlineThreshold = 5 * 60 * 1000; // 5 minutes

        // Device offline alert
        if (!device.is_online || (lastSeen && (now.getTime() - lastSeen.getTime()) > offlineThreshold)) {
          generatedAlerts.push({
            id: `offline-${device.id}`,
            type: 'device_offline',
            severity: 'high',
            title: 'Device Offline',
            message: `Device "${device.device_name}" at ${device.locations.location_name} is offline`,
            device_id: device.id,
            device_name: device.device_name,
            location_name: device.locations.location_name,
            timestamp: now.toISOString(),
            resolved: false
          });
        }

        // Camera error alert
        if (latestHeartbeat?.camera_status === 'error') {
          generatedAlerts.push({
            id: `camera-${device.id}`,
            type: 'camera_error',
            severity: 'medium',
            title: 'Camera Error',
            message: `Camera malfunction detected on device "${device.device_name}"`,
            device_id: device.id,
            device_name: device.device_name,
            location_name: device.locations.location_name,
            timestamp: now.toISOString(),
            resolved: false
          });
        }

        // High CPU usage alert
        if (latestHeartbeat?.cpu_usage && latestHeartbeat.cpu_usage > 80) {
          generatedAlerts.push({
            id: `cpu-${device.id}`,
            type: 'high_cpu',
            severity: 'medium',
            title: 'High CPU Usage',
            message: `Device "${device.device_name}" CPU usage is ${latestHeartbeat.cpu_usage}%`,
            device_id: device.id,
            device_name: device.device_name,
            location_name: device.locations.location_name,
            timestamp: now.toISOString(),
            resolved: false
          });
        }

        // High memory usage alert
        if (latestHeartbeat?.memory_usage && latestHeartbeat.memory_usage > 85) {
          generatedAlerts.push({
            id: `memory-${device.id}`,
            type: 'high_memory',
            severity: 'medium',
            title: 'High Memory Usage',
            message: `Device "${device.device_name}" memory usage is ${latestHeartbeat.memory_usage}%`,
            device_id: device.id,
            device_name: device.device_name,
            location_name: device.locations.location_name,
            timestamp: now.toISOString(),
            resolved: false
          });
        }
      });

      setDevices(processedDevices);
      setAlerts(generatedAlerts);
      
    } catch (error: any) {
      console.error('Error loading system status:', error);
      toast({
        title: "Error",
        description: "Failed to load system status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'device_offline':
        return <WifiOff className="h-4 w-4" />;
      case 'camera_error':
        return <CameraOff className="h-4 w-4" />;
      case 'high_cpu':
      case 'high_memory':
        return <Activity className="h-4 w-4" />;
      case 'database_error':
        return <Database className="h-4 w-4" />;
      case 'auth_error':
        return <Users className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system alerts...</span>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');
  const lowAlerts = alerts.filter(a => a.severity === 'low');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Alerts</h2>
        <p className="text-muted-foreground">
          Real-time monitoring of system health and device status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{mediumAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {devices.filter(d => d.is_online).length}/{devices.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">All Systems Operational</h3>
              <p className="text-muted-foreground">
                No active alerts. All devices are functioning normally.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {criticalAlerts.map((alert) => (
            <Alert key={alert.id} variant="destructive">
              {getAlertIcon(alert.type)}
              <AlertTitle className="flex items-center gap-2">
                {alert.title}
                <Badge variant={getSeverityVariant(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p>{alert.message}</p>
                  {alert.location_name && (
                    <p className="text-sm mt-1">Location: {alert.location_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}

          {highAlerts.map((alert) => (
            <Alert key={alert.id}>
              {getAlertIcon(alert.type)}
              <AlertTitle className="flex items-center gap-2">
                {alert.title}
                <Badge variant={getSeverityVariant(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p>{alert.message}</p>
                  {alert.location_name && (
                    <p className="text-sm mt-1">Location: {alert.location_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}

          {mediumAlerts.map((alert) => (
            <Alert key={alert.id}>
              {getAlertIcon(alert.type)}
              <AlertTitle className="flex items-center gap-2">
                {alert.title}
                <Badge variant={getSeverityVariant(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p>{alert.message}</p>
                  {alert.location_name && (
                    <p className="text-sm mt-1">Location: {alert.location_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemAlerts;