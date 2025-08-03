import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Server, 
  Database, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Cpu,
  Wifi,
  Camera,
  RefreshCw,
  Download,
  Loader2
} from "lucide-react";

interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'error';
    connections: number;
    responseTime: number;
  };
  devices: {
    total: number;
    online: number;
    offline: number;
    errors: number;
  };
  performance: {
    totalUsers: number;
    activeUsers: number;
    attendanceToday: number;
    averageResponseTime: number;
  };
}

interface DeviceStatus {
  id: string;
  device_name: string;
  device_code: string;
  is_online: boolean;
  last_heartbeat: string | null;
  status: string;
  camera_status: string;
  network_status: string;
  location_name: string;
}

const SystemMonitoring = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: { status: 'healthy', connections: 0, responseTime: 0 },
    devices: { total: 0, online: 0, offline: 0, errors: 0 },
    performance: { totalUsers: 0, activeUsers: 0, attendanceToday: 0, averageResponseTime: 0 }
  });
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSystemData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const startTime = Date.now();
      
      // Load device statuses
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select(`
          *,
          locations (
            location_name
          )
        `);

      if (deviceError) throw deviceError;

      // Calculate database response time
      const responseTime = Date.now() - startTime;

      // Process device data
      const deviceStatuses: DeviceStatus[] = (deviceData || []).map(device => ({
        id: device.id,
        device_name: device.device_name,
        device_code: device.device_code,
        is_online: device.is_online,
        last_heartbeat: device.last_heartbeat,
        status: device.is_online ? 'online' : 'offline',
        camera_status: 'working', // Would come from heartbeat data
        network_status: 'connected', // Would come from heartbeat data
        location_name: (device.locations as any)?.location_name || 'Unknown'
      }));

      setDevices(deviceStatuses);

      // Get user counts
      const { data: userData, error: userError } = await supabase
        .from('admin_users')
        .select('id, is_active');

      if (userError) throw userError;

      // Get today's attendance count
      const today = new Date().toISOString().split('T')[0];
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_events')
        .select('id')
        .gte('timestamp', `${today}T00:00:00.000Z`)
        .lt('timestamp', `${today}T23:59:59.999Z`);

      if (attendanceError) throw attendanceError;

      // Update system health
      setSystemHealth({
        database: {
          status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'warning' : 'error',
          connections: 1, // Would get from actual monitoring
          responseTime
        },
        devices: {
          total: deviceStatuses.length,
          online: deviceStatuses.filter(d => d.is_online).length,
          offline: deviceStatuses.filter(d => !d.is_online).length,
          errors: deviceStatuses.filter(d => d.status === 'error').length
        },
        performance: {
          totalUsers: userData?.length || 0,
          activeUsers: userData?.filter(u => u.is_active).length || 0,
          attendanceToday: attendanceData?.length || 0,
          averageResponseTime: responseTime
        }
      });

    } catch (error: any) {
      console.error('Error loading system data:', error);
      toast({
        title: "Error",
        description: "Failed to load system monitoring data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadSystemData();
  };

  const exportSystemReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      system_health: systemHealth,
      devices: devices,
      generated_by: 'JusTrack System Monitoring'
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `justrack-system-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "System report exported successfully"
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'error':
      case 'offline':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <Badge variant="default">Online</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      case 'error':
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor system health, device status, and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={refreshData} variant="outline" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportSystemReport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Health</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemHealth.database.status)}
              <div className="text-2xl font-bold capitalize">{systemHealth.database.status}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Response: {systemHealth.database.responseTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemHealth.devices.online}/{systemHealth.devices.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemHealth.devices.online} online, {systemHealth.devices.offline} offline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemHealth.performance.activeUsers}/{systemHealth.performance.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Admin users registered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.performance.attendanceToday}</div>
            <p className="text-xs text-muted-foreground">
              Attendance events today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Device Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Last Heartbeat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{device.device_name}</div>
                      <div className="text-sm text-muted-foreground">{device.device_code}</div>
                    </div>
                  </TableCell>
                  <TableCell>{device.location_name}</TableCell>
                  <TableCell>{getStatusBadge(device.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Camera className="h-3 w-3" />
                      <span className="text-sm">{device.camera_status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Wifi className="h-3 w-3" />
                      <span className="text-sm">{device.network_status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {device.last_heartbeat ? (
                      <div>
                        <div className="text-sm">
                          {new Date(device.last_heartbeat).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((Date.now() - new Date(device.last_heartbeat).getTime()) / (1000 * 60))} min ago
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Alerts */}
      {systemHealth.devices.offline > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemHealth.devices.offline > 0 && (
                <div className="flex items-center space-x-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>{systemHealth.devices.offline} device(s) are offline</span>
                </div>
              )}
              {systemHealth.database.status !== 'healthy' && (
                <div className="flex items-center space-x-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Database response time is elevated ({systemHealth.database.responseTime}ms)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SystemMonitoring;