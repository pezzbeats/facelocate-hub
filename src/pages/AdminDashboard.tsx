import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  MapPin, 
  Monitor, 
  Clock, 
  Settings, 
  Plus,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  Eye,
  Wifi,
  WifiOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jusTrackLogo from "@/assets/justrack-logo.png";

// Types for real-time data
interface EmployeeStatus {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department: string;
  current_status: string;
  current_location_name: string;
  last_activity: string;
}

interface AttendanceEvent {
  id: string;
  employee_id: string;
  event_type: string;
  timestamp: string;
  location_id: string;
  employee_name?: string;
  location_name?: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [employeeStats, setEmployeeStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    tempExit: 0
  });
  const [currentStatus, setCurrentStatus] = useState<EmployeeStatus[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
    loadLocations();
    loadDevices();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('attendance_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance_events' 
      }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load employee current status
      const { data: statusData } = await supabase
        .from('employee_current_status')
        .select('*')
        .order('last_activity', { ascending: false });

      if (statusData) {
        setCurrentStatus(statusData);
        
        // Calculate stats
        const stats = statusData.reduce((acc, emp) => {
          acc.total++;
          if (emp.current_status === 'clocked_in') acc.present++;
          else if (emp.current_status === 'temporary_exit') acc.tempExit++;
          else acc.absent++;
          return acc;
        }, { total: 0, present: 0, absent: 0, tempExit: 0 });
        
        setEmployeeStats(stats);
      }

      // Load recent events with employee and location details
      const { data: eventsData } = await supabase
        .from('attendance_events')
        .select(`
          *,
          employees!inner(full_name),
          locations!inner(location_name)
        `)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (eventsData) {
        const formattedEvents = eventsData.map(event => ({
          ...event,
          employee_name: event.employees?.full_name,
          location_name: event.locations?.location_name
        }));
        setRecentEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadLocations = async () => {
    try {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('location_name');
      
      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const { data } = await supabase
        .from('devices')
        .select(`
          *,
          locations!inner(location_name)
        `)
        .eq('is_active', true)
        .order('device_name');
      
      setDevices(data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return time.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-admin">
      {/* Admin Header */}
      <header className="bg-card border-b border-border shadow-elegant">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={jusTrackLogo} alt="JusTrack" className="h-10 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">JusTrack Admin</h1>
                <p className="text-sm text-muted-foreground">Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">Admin User</p>
                <p className="text-xs text-muted-foreground">System Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Devices
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-primary text-primary-foreground shadow-primary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-foreground/80 text-sm">Total Employees</p>
                      <p className="text-3xl font-bold">{employeeStats.total}</p>
                    </div>
                    <Users className="h-12 w-12 text-primary-foreground/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-success text-success-foreground shadow-success">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-success-foreground/80 text-sm">Present Today</p>
                      <p className="text-3xl font-bold">{employeeStats.present}</p>
                    </div>
                    <CheckCircle2 className="h-12 w-12 text-success-foreground/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-warning text-warning-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-warning-foreground/80 text-sm">Temporary Exit</p>
                      <p className="text-3xl font-bold">{employeeStats.tempExit}</p>
                    </div>
                    <Clock className="h-12 w-12 text-warning-foreground/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-destructive text-destructive-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-destructive-foreground/80 text-sm">Absent Today</p>
                      <p className="text-3xl font-bold">{employeeStats.absent}</p>
                    </div>
                    <XCircle className="h-12 w-12 text-destructive-foreground/60" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current Status and Recent Events */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Current Employee Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Employee Status</CardTitle>
                  <CardDescription>Real-time attendance status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {currentStatus.slice(0, 10).map((employee) => (
                      <div key={employee.employee_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            employee.current_status === 'clocked_in' ? 'bg-success' : 
                            employee.current_status === 'temporary_exit' ? 'bg-warning' : 'bg-muted-foreground'
                          }`} />
                          <div>
                            <p className="font-medium text-sm">{employee.full_name}</p>
                            <p className="text-xs text-muted-foreground">{employee.employee_code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            employee.current_status === 'clocked_in' ? 'default' : 
                            employee.current_status === 'temporary_exit' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {employee.current_status === 'clocked_in' ? 'Present' : 
                             employee.current_status === 'temporary_exit' ? 'Step Out' : 'Absent'}
                          </Badge>
                          {employee.current_location_name && (
                            <p className="text-xs text-muted-foreground mt-1">{employee.current_location_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest attendance events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recentEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            event.event_type.includes('in') ? 'bg-success' : 'bg-primary'
                          }`} />
                          <div>
                            <p className="font-medium text-sm">{event.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.event_type.replace('_', ' ')} at {event.location_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium">{formatTimeAgo(event.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Employee Management</h2>
                <p className="text-muted-foreground">Manage employee profiles and attendance data</p>
              </div>
              <Button variant="admin">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentStatus.map((employee) => (
                    <Card key={employee.employee_id} className="hover:shadow-elegant transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{employee.full_name}</h3>
                            <p className="text-sm text-muted-foreground">{employee.employee_code}</p>
                          </div>
                          <Badge variant={
                            employee.current_status === 'clocked_in' ? 'default' : 
                            employee.current_status === 'temporary_exit' ? 'secondary' : 'destructive'
                          }>
                            {employee.current_status === 'clocked_in' ? 'Present' : 
                             employee.current_status === 'temporary_exit' ? 'Step Out' : 'Absent'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{employee.department}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Location Management</h2>
                <p className="text-muted-foreground">Manage attendance locations and access points</p>
              </div>
              <Button variant="admin">
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {locations.map((location) => (
                <Card key={location.id} className="hover:shadow-elegant transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {location.location_name}
                      </CardTitle>
                      <Badge variant="outline" className="text-success border-success">
                        Active
                      </Badge>
                    </div>
                    <CardDescription>{location.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">
                        Code: {location.location_code}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-success rounded-full" />
                        <span className="text-sm text-success">Online</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Device Management</h2>
                <p className="text-muted-foreground">Monitor and manage attendance kiosk devices</p>
              </div>
              <Button variant="admin">
                <Plus className="h-4 w-4 mr-2" />
                Register Device
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => (
                <Card key={device.id} className="hover:shadow-elegant transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Monitor className="h-5 w-5" />
                        {device.device_name}
                      </CardTitle>
                      <Badge variant={device.is_online ? 'default' : 'destructive'}>
                        {device.is_online ? (
                          <div className="flex items-center gap-1">
                            <Wifi className="h-3 w-3" />
                            Online
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <WifiOff className="h-3 w-3" />
                            Offline
                          </div>
                        )}
                      </Badge>
                    </div>
                    <CardDescription>{device.locations?.location_name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Code: {device.device_code}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Last seen: {device.last_heartbeat ? formatTimeAgo(device.last_heartbeat) : 'Never'}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          Configure
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;