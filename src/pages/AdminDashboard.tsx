import { useState, useEffect, memo, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import BreadcrumbNavigation from "@/components/BreadcrumbNavigation";
import QuickActions from "@/components/QuickActions";
import GlobalSearch from "@/components/GlobalSearch";

// Import components directly instead of lazy loading to fix module import issues
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import EmployeeManagement from "@/components/EmployeeManagement";
import LocationManagement from "@/components/LocationManagement";
import DeviceManagement from "@/components/DeviceManagement";
import AttendanceReports from "@/components/AttendanceReports";
import TemporaryExitManagement from "@/components/TemporaryExitManagement";
import SystemSettings from "@/components/SystemSettings";
import UserManagement from "@/components/UserManagement";
import SystemMonitoring from "@/components/SystemMonitoring";
import NotificationCenter from "@/components/NotificationCenter";
import NotificationManagement from "@/components/NotificationManagement";
import SystemAlerts from "@/components/SystemAlerts";
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
  WifiOff,
  Building2,
  BarChart3,
  LogOut,
  FileText,
  Bell,
  AlertTriangle
} from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";
import { supabase } from "@/integrations/supabase/client";

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
  const [currentUser, setCurrentUser] = useState<any>(null);
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

  // Load user info
  useEffect(() => {
    const loadUserInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setCurrentUser(adminUser);
      }
    };
    loadUserInfo();
  }, []);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleQuickAction = (action: string) => {
    const actionMap: { [key: string]: string } = {
      "add-employee": "employees",
      "add-location": "locations", 
      "register-device": "devices",
      "generate-report": "reports",
      "import-employees": "employees",
      "system-settings": "admin",
    };
    
    const tab = actionMap[action];
    if (tab) {
      setActiveTab(tab);
      // Update URL hash for breadcrumb navigation
      window.location.hash = `#${tab}`;
    }
  };

  const handleSearchSelect = (result: any) => {
    const typeMap: { [key: string]: string } = {
      "employee": "employees",
      "location": "locations",
      "device": "devices",
    };
    
    const tab = typeMap[result.type];
    if (tab) {
      setActiveTab(tab);
      window.location.hash = `#${tab}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-accent/10">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border/50 shadow-elegant">
        <div className="container mx-auto px-3 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 lg:space-x-4 min-w-0 flex-1">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-primary p-1.5 lg:p-2 shadow-glow flex-shrink-0">
                <img src={jusTrackLogo} alt="JusTrack" className="w-full h-full object-contain filter brightness-0 invert" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg lg:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate">
                  JusTrack Admin
                </h1>
                <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
              <div className="hidden lg:block">
                <GlobalSearch onResultSelect={handleSearchSelect} />
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
              <div className="flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-2 rounded-lg bg-muted/30 border border-border/50 min-w-0">
                <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs lg:text-sm font-medium text-primary-foreground">
                    {currentUser?.full_name?.charAt(0) || 'A'}
                  </span>
                </div>
                <div className="text-right min-w-0 hidden sm:block">
                  <p className="text-xs lg:text-sm font-medium text-foreground truncate">
                    {currentUser?.full_name || 'Admin User'}
                  </p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
              </div>
              <div className="animate-pulse bg-muted h-6 w-6 lg:h-8 lg:w-8 rounded">
                <NotificationCenter />
              </div>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="hover:bg-destructive hover:text-destructive-foreground border-border/50 flex-shrink-0"
                size="sm"
              >
                <LogOut className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <BreadcrumbNavigation />

      <main className="container mx-auto px-3 lg:px-6 py-4 lg:py-8">
        <Tabs value={activeTab} onValueChange={(value) => startTransition(() => {
          setActiveTab(value);
          window.location.hash = `#${value}`;
        })} className="space-y-8">
          <div className="w-full overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex h-14 items-center justify-start w-max min-w-full bg-muted/30 border border-border/50 backdrop-blur-sm p-1 gap-1">
              <TabsTrigger 
                value="dashboard" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="leading-none">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="employees" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <Users className="h-5 w-5" />
                <span className="leading-none">Employees</span>
              </TabsTrigger>
              <TabsTrigger 
                value="locations" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <Building2 className="h-5 w-5" />
                <span className="leading-none">Locations</span>
              </TabsTrigger>
              <TabsTrigger 
                value="devices" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <Monitor className="h-5 w-5" />
                <span className="leading-none">Devices</span>
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <FileText className="h-5 w-5" />
                <span className="leading-none">Reports</span>
              </TabsTrigger>
              <TabsTrigger 
                value="admin" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <Settings className="h-5 w-5" />
                <span className="leading-none">Settings</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <Bell className="h-5 w-5" />
                <span className="leading-none">Notifications</span>
              </TabsTrigger>
              <TabsTrigger 
                value="alerts" 
                className="flex flex-col items-center gap-1 min-w-[80px] h-12 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all px-3 py-2"
              >
                <AlertTriangle className="h-5 w-5" />
                <span className="leading-none">Alerts</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-primary border-0 shadow-elegant hover:shadow-glow transition-all duration-300">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
                <CardContent className="relative p-6 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-primary-foreground/90 text-sm font-medium">Total Employees</p>
                      <p className="text-3xl font-bold tracking-tight">{employeeStats.total}</p>
                      <p className="text-primary-foreground/70 text-xs">Active in system</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden bg-gradient-to-br from-success via-success-dark to-success border-0 shadow-elegant hover:shadow-success transition-all duration-300">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
                <CardContent className="relative p-6 text-success-foreground">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-success-foreground/90 text-sm font-medium">Present Today</p>
                      <p className="text-3xl font-bold tracking-tight">{employeeStats.present}</p>
                      <p className="text-success-foreground/70 text-xs">Currently clocked in</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden bg-gradient-to-br from-warning via-warning-dark to-warning border-0 shadow-elegant hover:shadow-warning transition-all duration-300">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
                <CardContent className="relative p-6 text-warning-foreground">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-warning-foreground/90 text-sm font-medium">Temporary Exit</p>
                      <p className="text-3xl font-bold tracking-tight">{employeeStats.tempExit}</p>
                      <p className="text-warning-foreground/70 text-xs">Stepped out temporarily</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Clock className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden bg-gradient-to-br from-destructive via-destructive-dark to-destructive border-0 shadow-elegant hover:shadow-destructive transition-all duration-300">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
                <CardContent className="relative p-6 text-destructive-foreground">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-destructive-foreground/90 text-sm font-medium">Absent Today</p>
                      <p className="text-3xl font-bold tracking-tight">{employeeStats.absent}</p>
                      <p className="text-destructive-foreground/70 text-xs">Not present</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <XCircle className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <QuickActions onActionClick={handleQuickAction} />

            {/* Mobile Search */}
            <div className="lg:hidden">
              <Card className="border-border/40 bg-gradient-to-br from-card via-card/95 to-muted/20">
                <CardContent className="p-4">
                  <GlobalSearch onResultSelect={handleSearchSelect} />
                </CardContent>
              </Card>
            </div>

            {/* Current Status and Recent Events */}
            <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
              {/* Current Employee Status */}
              <Card className="bg-card/60 backdrop-blur-sm border-border/50 shadow-elegant">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Activity className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Live Status</CardTitle>
                      <CardDescription>Real-time employee attendance</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                    {currentStatus.slice(0, 10).map((employee) => (
                      <div key={employee.employee_id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ring-2 ring-white/20 ${
                            employee.current_status === 'clocked_in' ? 'bg-success shadow-success' : 
                            employee.current_status === 'temporary_exit' ? 'bg-warning shadow-warning' : 'bg-muted-foreground'
                          }`} />
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                              <span className="text-xs font-medium text-primary-foreground">
                                {employee.full_name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{employee.full_name}</p>
                              <p className="text-xs text-muted-foreground">{employee.employee_code}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={
                            employee.current_status === 'clocked_in' ? 'default' : 
                            employee.current_status === 'temporary_exit' ? 'secondary' : 'destructive'
                          } className="text-xs font-medium">
                            {employee.current_status === 'clocked_in' ? 'Present' : 
                             employee.current_status === 'temporary_exit' ? 'Step Out' : 'Absent'}
                          </Badge>
                          {employee.current_location_name && (
                            <p className="text-xs text-muted-foreground">{employee.current_location_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-card/60 backdrop-blur-sm border-border/50 shadow-elegant">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
                      <Clock className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                      <CardDescription>Latest attendance events</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                    {recentEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ring-2 ring-white/20 ${
                            event.event_type.includes('in') ? 'bg-success shadow-success' : 'bg-primary shadow-primary'
                          }`} />
                          <div>
                            <p className="font-medium text-sm text-foreground">{event.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="capitalize">{event.event_type.replace('_', ' ')}</span> at {event.location_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-foreground">{formatTimeAgo(event.timestamp)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
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
            <EmployeeManagement />
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-6">
            <LocationManagement />
          </TabsContent>

          {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceManagement />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="attendance">Attendance Reports</TabsTrigger>
              <TabsTrigger value="exits">Temporary Exits</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analytics">
              <AnalyticsDashboard />
            </TabsContent>
            
            <TabsContent value="attendance">
              <AttendanceReports />
            </TabsContent>
            
            <TabsContent value="exits">
              <TemporaryExitManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Admin Tab */}
        <TabsContent value="admin" className="space-y-6">
          <Tabs defaultValue="settings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">System Settings</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="monitoring">System Monitoring</TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings">
              <SystemSettings />
            </TabsContent>
            
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
            
            <TabsContent value="monitoring">
              <SystemMonitoring />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationManagement />
        </TabsContent>

        {/* System Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <SystemAlerts />
        </TabsContent>
      </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;