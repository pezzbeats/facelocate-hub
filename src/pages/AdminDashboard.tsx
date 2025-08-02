import { useState } from "react";
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
  Home
} from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-gradient-admin">
      {/* Admin Header */}
      <header className="bg-card border-b border-border shadow-elegant">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={jusTrackLogo} alt="JusTrack" className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-foreground">JusTrack Admin</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-primary text-primary-foreground shadow-primary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-foreground/80 text-sm">Total Employees</p>
                      <p className="text-3xl font-bold">24</p>
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
                      <p className="text-3xl font-bold">18</p>
                    </div>
                    <CheckCircle2 className="h-12 w-12 text-success-foreground/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-warning text-warning-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-warning-foreground/80 text-sm">Active Devices</p>
                      <p className="text-3xl font-bold">6</p>
                    </div>
                    <Monitor className="h-12 w-12 text-warning-foreground/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-destructive text-destructive-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-destructive-foreground/80 text-sm">Absent Today</p>
                      <p className="text-3xl font-bold">6</p>
                    </div>
                    <XCircle className="h-12 w-12 text-destructive-foreground/60" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="admin" size="lg" className="h-20 flex-col">
                    <Plus className="h-6 w-6 mb-2" />
                    Add Employee
                  </Button>
                  <Button variant="admin" size="lg" className="h-20 flex-col">
                    <MapPin className="h-6 w-6 mb-2" />
                    Add Location
                  </Button>
                  <Button variant="admin" size="lg" className="h-20 flex-col">
                    <Monitor className="h-6 w-6 mb-2" />
                    Register Device
                  </Button>
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
                <div className="space-y-4">
                  {[
                    { name: "John Doe", action: "Clock In", location: "Main Gate", time: "9:15 AM", status: "success" },
                    { name: "Sarah Wilson", action: "Clock Out", location: "Office Building", time: "8:45 AM", status: "success" },
                    { name: "Mike Johnson", action: "Transfer", location: "Warehouse → Office", time: "8:30 AM", status: "warning" },
                    { name: "Emma Davis", action: "Clock In", location: "Main Gate", time: "8:15 AM", status: "success" },
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          activity.status === 'success' ? 'bg-success' : 
                          activity.status === 'warning' ? 'bg-warning' : 'bg-destructive'
                        }`} />
                        <div>
                          <p className="font-medium">{activity.name}</p>
                          <p className="text-sm text-muted-foreground">{activity.action} at {activity.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Employee Management</h2>
                <p className="text-muted-foreground">Manage employee profiles and face recognition data</p>
              </div>
              <Button variant="admin">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "John Doe", id: "EMP001", status: "present", location: "Main Gate" },
                    { name: "Sarah Wilson", id: "EMP002", status: "absent", location: "Not Clocked In" },
                    { name: "Mike Johnson", id: "EMP003", status: "present", location: "Warehouse" },
                    { name: "Emma Davis", id: "EMP004", status: "present", location: "Office Building" },
                    { name: "Alex Brown", id: "EMP005", status: "temporary_exit", location: "Stepped Out" },
                    { name: "Lisa Chen", id: "EMP006", status: "absent", location: "Not Clocked In" },
                  ].map((employee) => (
                    <Card key={employee.id} className="hover:shadow-elegant transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{employee.name}</h3>
                            <p className="text-sm text-muted-foreground">{employee.id}</p>
                          </div>
                          <Badge variant={
                            employee.status === 'present' ? 'default' : 
                            employee.status === 'temporary_exit' ? 'secondary' : 'destructive'
                          }>
                            {employee.status === 'present' ? 'Present' : 
                             employee.status === 'temporary_exit' ? 'Step Out' : 'Absent'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{employee.location}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            Edit
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
              {[
                { name: "Main Gate", address: "Building Entrance", devices: 2, employees: 8 },
                { name: "Office Building", address: "Floor 1, Reception", devices: 1, employees: 12 },
                { name: "Warehouse", address: "Storage Facility", devices: 2, employees: 6 },
                { name: "Conference Room", address: "Floor 2, Meeting Area", devices: 1, employees: 4 },
              ].map((location, index) => (
                <Card key={index} className="hover:shadow-elegant transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {location.name}
                      </CardTitle>
                      <Badge variant="outline">{location.devices} Devices</Badge>
                    </div>
                    <CardDescription>{location.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">
                        {location.employees} employees present
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-success rounded-full" />
                        <span className="text-sm text-success">Active</span>
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
              {[
                { name: "Main Gate Kiosk 1", location: "Main Gate", status: "online", lastSeen: "Just now" },
                { name: "Main Gate Kiosk 2", location: "Main Gate", status: "online", lastSeen: "2 min ago" },
                { name: "Office Entrance", location: "Office Building", status: "online", lastSeen: "1 min ago" },
                { name: "Warehouse Scanner 1", location: "Warehouse", status: "offline", lastSeen: "15 min ago" },
                { name: "Warehouse Scanner 2", location: "Warehouse", status: "online", lastSeen: "5 min ago" },
                { name: "Conference Room", location: "Conference Room", status: "online", lastSeen: "Just now" },
              ].map((device, index) => (
                <Card key={index} className="hover:shadow-elegant transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Monitor className="h-5 w-5" />
                        {device.name}
                      </CardTitle>
                      <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                        {device.status === 'online' ? (
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 bg-success rounded-full" />
                            Online
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Offline
                          </div>
                        )}
                      </Badge>
                    </div>
                    <CardDescription>{device.location}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Last seen: {device.lastSeen}
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