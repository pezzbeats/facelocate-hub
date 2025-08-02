import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { Users, TrendingUp, Clock, Target, Calendar } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

interface MetricCard {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface ChartData {
  attendanceTrend: { date: string; checkins: number }[];
  departmentDistribution: { name: string; value: number; color: string }[];
  locationUsage: { location: string; checkins: number }[];
  hourlyCheckins: { hour: string; checkins: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState<string>("30");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [chartData, setChartData] = useState<ChartData>({
    attendanceTrend: [],
    departmentDistribution: [],
    locationUsage: [],
    hourlyCheckins: []
  });
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (locations.length > 0) {
      loadAnalyticsData();
    }
  }, [timeRange, selectedLocation, locations]);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('is_active', true);
      
      if (error) throw error;
      setLocations(data?.map(l => ({ id: l.id, name: l.location_name })) || []);
    } catch (error: any) {
      console.error('Error loading locations:', error);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange);
      const startDate = subDays(new Date(), days);
      
      await Promise.all([
        loadMetrics(startDate),
        loadChartData(startDate)
      ]);
    } catch (error: any) {
      toast({
        title: "Error Loading Analytics",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (startDate: Date) => {
    try {
      // Get present today count
      const todayStart = startOfDay(new Date());
      const { data: presentToday } = await supabase
        .from('attendance_events')
        .select('employee_id')
        .eq('event_type', 'clock_in')
        .gte('timestamp', todayStart.toISOString())
        .lte('timestamp', new Date().toISOString());

      const presentCount = new Set(presentToday?.map(e => e.employee_id) || []).size;

      // Get total employees
      const { data: totalEmployees } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true);

      const totalCount = totalEmployees?.length || 0;
      const attendanceRate = totalCount > 0 ? (presentCount / totalCount * 100).toFixed(1) : "0";

      // Get total hours today (estimated)
      const totalHours = presentCount * 8; // Estimate 8 hours per present employee

      // Calculate attendance trend
      const { data: trendData } = await supabase
        .from('attendance_events')
        .select('timestamp')
        .eq('event_type', 'clock_in')
        .gte('timestamp', subDays(new Date(), 7).toISOString())
        .lte('timestamp', new Date().toISOString());

      const weekCount = new Set(trendData?.map(e => e.timestamp) || []).size;
      const trendPercentage = weekCount > 0 ? ((presentCount - weekCount) / weekCount * 100).toFixed(1) : "0";

      setMetrics([
        {
          title: "Present Today",
          value: presentCount.toString(),
          subtitle: `${attendanceRate}% attendance rate`,
          trend: `${trendPercentage}%`,
          icon: Users,
          color: "text-primary"
        },
        {
          title: "Attendance Trend",
          value: `${trendPercentage}%`,
          subtitle: "vs last week",
          icon: parseFloat(trendPercentage) >= 0 ? TrendingUp : TrendingUp,
          color: parseFloat(trendPercentage) >= 0 ? "text-success" : "text-destructive"
        },
        {
          title: "Total Hours",
          value: `${totalHours}h`,
          subtitle: "Total hours today",
          icon: Clock,
          color: "text-primary"
        },
        {
          title: "Total Employees",
          value: totalCount.toString(),
          subtitle: "Active workforce",
          icon: Target,
          color: "text-primary"
        }
      ]);
    } catch (error: any) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadChartData = async (startDate: Date) => {
    try {
      let query = supabase
        .from('attendance_events')
        .select(`
          timestamp,
          event_type,
          location_id,
          employee_id,
          employees!inner(department),
          locations(location_name)
        `)
        .in('event_type', ['clock_in', 'transfer_in'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', new Date().toISOString());

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process attendance trend data
      const trendMap = new Map<string, number>();
      const departmentMap = new Map<string, number>();
      const locationMap = new Map<string, number>();
      const hourlyMap = new Map<string, number>();

      data?.forEach(event => {
        const date = format(new Date(event.timestamp), 'MMM dd');
        const department = event.employees?.department || 'Unknown';
        const location = event.locations?.location_name || 'Unknown';
        const hour = format(new Date(event.timestamp), 'HH:00');

        // Trend data
        trendMap.set(date, (trendMap.get(date) || 0) + 1);

        // Department data
        departmentMap.set(department, (departmentMap.get(department) || 0) + 1);

        // Location data
        locationMap.set(location, (locationMap.get(location) || 0) + 1);

        // Hourly data (today only)
        if (format(new Date(event.timestamp), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        }
      });

      // Convert to chart data format
      const attendanceTrend = Array.from(trendMap.entries()).map(([date, checkins]) => ({
        date,
        checkins
      }));

      const departmentDistribution = Array.from(departmentMap.entries()).map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }));

      const locationUsage = Array.from(locationMap.entries()).map(([location, checkins]) => ({
        location: location.length > 15 ? location.substring(0, 15) + '...' : location,
        checkins
      }));

      const hourlyCheckins = Array.from(hourlyMap.entries()).map(([hour, checkins]) => ({
        hour,
        checkins
      })).sort((a, b) => a.hour.localeCompare(b.hour));

      setChartData({
        attendanceTrend,
        departmentDistribution,
        locationUsage,
        hourlyCheckins
      });
    } catch (error: any) {
      console.error('Error loading chart data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Real-time attendance insights and trends</p>
        </div>
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(location => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <metric.icon className={`h-8 w-8 ${metric.color}`} />
                <div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  {metric.subtitle && (
                    <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Daily check-ins over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="checkins" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Employee distribution by department</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.departmentDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.departmentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Location Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Location Usage</CardTitle>
            <CardDescription>Check-ins by location</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.locationUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="location" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="checkins" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Check-ins Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Check-ins by Hour</CardTitle>
            <CardDescription>Hourly check-in distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.hourlyCheckins}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="checkins" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;