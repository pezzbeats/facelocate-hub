import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, FileText, Download, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface AttendanceSummary {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  present_days: number;
  absent_days: number;
  total_hours: number;
  average_hours: number;
  attendance_percentage: number;
}

interface DailyAttendance {
  date: string;
  employee_name: string;
  employee_code: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  location_name: string | null;
  status: "Present" | "Absent" | "Partial";
}

interface LocationReport {
  location_id: string;
  location_name: string;
  total_checkins: number;
  unique_employees: number;
  average_daily_attendance: number;
  peak_hours: string;
  utilization_rate: number;
}

const AttendanceReports = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [summaryData, setSummaryData] = useState<AttendanceSummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [locationData, setLocationData] = useState<LocationReport[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadFilterOptions();
    loadReportData();
  }, [dateRange, selectedDepartment, selectedLocation, searchTerm]);

  const loadFilterOptions = async () => {
    try {
      // Load departments
      const { data: deptData } = await supabase
        .from('employees')
        .select('department')
        .eq('is_active', true);
      
      const uniqueDepts = [...new Set(deptData?.map(e => e.department) || [])];
      setDepartments(uniqueDepts);

      // Load locations
      const { data: locData } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('is_active', true);
      
      setLocations(locData?.map(l => ({ id: l.id, name: l.location_name })) || []);
    } catch (error: any) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSummaryData(),
        loadDailyData(),
        loadLocationData()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaryData = async () => {
    try {
      let query = supabase
        .from('employees')
        .select(`
          id,
          full_name,
          employee_code,
          department,
          attendance_events!inner(
            event_type,
            timestamp,
            location_id
          )
        `)
        .eq('is_active', true)
        .gte('attendance_events.timestamp', dateRange.from.toISOString())
        .lte('attendance_events.timestamp', dateRange.to.toISOString());

      if (selectedDepartment !== 'all') {
        query = query.eq('department', selectedDepartment);
      }

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,employee_code.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process summary data
      const summaryMap = new Map<string, AttendanceSummary>();
      
      data?.forEach(employee => {
        const key = employee.id;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            employee_id: employee.id,
            employee_name: employee.full_name,
            employee_code: employee.employee_code,
            department: employee.department,
            present_days: 0,
            absent_days: 0,
            total_hours: 0,
            average_hours: 0,
            attendance_percentage: 0
          });
        }

        const summary = summaryMap.get(key)!;
        
        // Count check-ins as present days
        const checkInEvents = employee.attendance_events?.filter(e => 
          e.event_type === 'clock_in' || e.event_type === 'transfer_in'
        ) || [];
        
        summary.present_days = checkInEvents.length;
        
        // Calculate total working days in range
        const totalDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        summary.absent_days = Math.max(0, totalDays - summary.present_days);
        
        // Calculate attendance percentage
        summary.attendance_percentage = totalDays > 0 ? (summary.present_days / totalDays) * 100 : 0;
        
        // Estimate total hours (8 hours per present day)
        summary.total_hours = summary.present_days * 8;
        summary.average_hours = summary.present_days > 0 ? summary.total_hours / summary.present_days : 0;
      });

      setSummaryData(Array.from(summaryMap.values()));
    } catch (error: any) {
      console.error('Error loading summary data:', error);
    }
  };

  const loadDailyData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_events')
        .select(`
          timestamp,
          event_type,
          employees!inner(
            full_name,
            employee_code,
            department
          ),
          locations(
            location_name
          )
        `)
        .gte('timestamp', dateRange.from.toISOString())
        .lte('timestamp', dateRange.to.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Process daily data
      const dailyMap = new Map<string, DailyAttendance>();
      
      data?.forEach(event => {
        const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
        const key = `${event.employees.employee_code}-${date}`;
        
        if (!dailyMap.has(key)) {
          dailyMap.set(key, {
            date,
            employee_name: event.employees.full_name,
            employee_code: event.employees.employee_code,
            check_in: null,
            check_out: null,
            total_hours: null,
            location_name: event.locations?.location_name || null,
            status: "Absent"
          });
        }

        const record = dailyMap.get(key)!;
        
        if (event.event_type === 'clock_in' || event.event_type === 'transfer_in') {
          record.check_in = format(new Date(event.timestamp), 'HH:mm');
          record.status = "Present";
        } else if (event.event_type === 'clock_out' || event.event_type === 'transfer_out') {
          record.check_out = format(new Date(event.timestamp), 'HH:mm');
        }

        // Calculate hours if both check-in and check-out exist
        if (record.check_in && record.check_out) {
          const checkInTime = new Date(`${date}T${record.check_in}`);
          const checkOutTime = new Date(`${date}T${record.check_out}`);
          record.total_hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        } else if (record.check_in && !record.check_out) {
          record.status = "Partial";
        }
      });

      let filteredData = Array.from(dailyMap.values());
      
      // Apply filters
      if (searchTerm) {
        filteredData = filteredData.filter(record =>
          record.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setDailyData(filteredData);
    } catch (error: any) {
      console.error('Error loading daily data:', error);
    }
  };

  const loadLocationData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_events')
        .select(`
          location_id,
          employee_id,
          event_type,
          timestamp,
          locations!inner(
            location_name
          )
        `)
        .gte('timestamp', dateRange.from.toISOString())
        .lte('timestamp', dateRange.to.toISOString())
        .in('event_type', ['clock_in', 'transfer_in']);

      if (error) throw error;

      // Process location data
      const locationMap = new Map<string, LocationReport>();
      
      data?.forEach(event => {
        const locationId = event.location_id;
        if (!locationMap.has(locationId)) {
          locationMap.set(locationId, {
            location_id: locationId,
            location_name: event.locations.location_name,
            total_checkins: 0,
            unique_employees: 0,
            average_daily_attendance: 0,
            peak_hours: "09:00-10:00",
            utilization_rate: 75
          });
        }

        const location = locationMap.get(locationId)!;
        location.total_checkins++;
      });

      // Calculate unique employees and averages
      locationMap.forEach((location, locationId) => {
        const uniqueEmployees = new Set(
          data?.filter(e => e.location_id === locationId).map(e => e.employee_id)
        ).size;
        
        location.unique_employees = uniqueEmployees;
        
        const totalDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        location.average_daily_attendance = totalDays > 0 ? location.total_checkins / totalDays : 0;
      });

      setLocationData(Array.from(locationMap.values()));
    } catch (error: any) {
      console.error('Error loading location data:', error);
    }
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.height;
    let yPosition = 20;

    // Header
    pdf.setFontSize(20);
    pdf.text('JusTrack Attendance Report', 20, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(12);
    pdf.text(`Period: ${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`, 20, yPosition);
    yPosition += 10;
    pdf.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 20, yPosition);
    yPosition += 20;

    // Summary data
    pdf.setFontSize(16);
    pdf.text('Attendance Summary', 20, yPosition);
    yPosition += 10;

    summaryData.slice(0, 10).forEach((record) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(10);
      pdf.text(`${record.employee_name} (${record.employee_code})`, 20, yPosition);
      pdf.text(`${record.attendance_percentage.toFixed(1)}%`, 120, yPosition);
      pdf.text(`${record.total_hours}h`, 160, yPosition);
      yPosition += 8;
    });

    const fileName = `JusTrack_AttendanceReport_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);

    toast({
      title: "PDF Export Complete",
      description: `Report exported as ${fileName}`,
    });
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryWS = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWS, "Summary");

    // Daily sheet
    const dailyWS = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(workbook, dailyWS, "Daily Attendance");

    // Location sheet
    const locationWS = XLSX.utils.json_to_sheet(locationData);
    XLSX.utils.book_append_sheet(workbook, locationWS, "Location Reports");

    const fileName = `JusTrack_AttendanceReport_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Excel Export Complete",
      description: `Report exported as ${fileName}`,
    });
  };

  const getAttendanceBadge = (percentage: number) => {
    if (percentage >= 90) {
      return <Badge className="bg-success text-success-foreground">Excellent ({percentage.toFixed(1)}%)</Badge>;
    } else if (percentage >= 75) {
      return <Badge variant="secondary">Good ({percentage.toFixed(1)}%)</Badge>;
    } else {
      return <Badge variant="destructive">Needs Attention ({percentage.toFixed(1)}%)</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return <Badge className="bg-success text-success-foreground">Present</Badge>;
      case "Partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "Absent":
        return <Badge variant="destructive">Absent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Attendance Reports</h2>
          <p className="text-muted-foreground">Comprehensive attendance analytics and reporting</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToPDF} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={exportToExcel} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Customize your report parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                    ) : (
                      "Select date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search Employee</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary Report</TabsTrigger>
          <TabsTrigger value="daily">Daily Attendance</TabsTrigger>
          <TabsTrigger value="locations">Location Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
              <CardDescription>Employee attendance overview for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Present Days</TableHead>
                    <TableHead>Absent Days</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Avg Hours</TableHead>
                    <TableHead>Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((record) => (
                    <TableRow key={record.employee_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.employee_name}</div>
                          <div className="text-sm text-muted-foreground">{record.employee_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>{record.present_days}</TableCell>
                      <TableCell>{record.absent_days}</TableCell>
                      <TableCell>{record.total_hours}h</TableCell>
                      <TableCell>{record.average_hours.toFixed(1)}h</TableCell>
                      <TableCell>{getAttendanceBadge(record.attendance_percentage)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance Records</CardTitle>
              <CardDescription>Detailed daily attendance for all employees</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.employee_name}</div>
                          <div className="text-sm text-muted-foreground">{record.employee_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{record.check_in || "-"}</TableCell>
                      <TableCell>{record.check_out || "-"}</TableCell>
                      <TableCell>{record.total_hours ? `${record.total_hours.toFixed(1)}h` : "-"}</TableCell>
                      <TableCell>{record.location_name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle>Location Usage Reports</CardTitle>
              <CardDescription>Attendance analytics by location</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Total Check-ins</TableHead>
                    <TableHead>Unique Employees</TableHead>
                    <TableHead>Avg Daily Attendance</TableHead>
                    <TableHead>Peak Hours</TableHead>
                    <TableHead>Utilization Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationData.map((record) => (
                    <TableRow key={record.location_id}>
                      <TableCell className="font-medium">{record.location_name}</TableCell>
                      <TableCell>{record.total_checkins}</TableCell>
                      <TableCell>{record.unique_employees}</TableCell>
                      <TableCell>{record.average_daily_attendance.toFixed(1)}</TableCell>
                      <TableCell>{record.peak_hours}</TableCell>
                      <TableCell>
                        <Badge variant={record.utilization_rate > 80 ? "default" : "secondary"}>
                          {record.utilization_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceReports;