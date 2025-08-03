import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { Plus, Search, Edit, Trash2, Camera, User, Users, Filter, Download, MoreVertical, CheckSquare, Square } from "lucide-react";
import FaceRegistration from "./FaceRegistration";

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  hire_date: string;
  face_registered: boolean;
  is_active: boolean;
  created_at: string;
}

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    hire_date: ""
  });

  const departments = [
    "Human Resources",
    "Information Technology", 
    "Sales",
    "Operations",
    "Finance",
    "Marketing",
    "Field Staff"
  ];

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: "Error Loading Employees",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateEmployeeCode = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('employee_code')
      .order('employee_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error generating employee code:', error);
      return 'EMP001';
    }

    if (!data || data.length === 0) {
      return 'EMP001';
    }

    const lastCode = data[0].employee_code;
    const lastNumber = parseInt(lastCode.replace('EMP', ''));
    const nextNumber = lastNumber + 1;
    return `EMP${nextNumber.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update(formData)
          .eq('id', editingEmployee.id);

        if (error) throw error;

        toast({
          title: "Employee Updated",
          description: "Employee information has been updated successfully.",
        });
      } else {
        // Create new employee
        const employeeCode = await generateEmployeeCode();
        
        const { error } = await supabase
          .from('employees')
          .insert({
            ...formData,
            employee_code: employeeCode
          });

        if (error) throw error;

        toast({
          title: "Employee Added",
          description: `Employee ${employeeCode} has been added successfully.`,
        });
      }

      // Reset form and reload data
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        department: "",
        designation: "",
        hire_date: ""
      });
      setShowAddDialog(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      department: employee.department,
      designation: employee.designation || "",
      hire_date: employee.hire_date || ""
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.full_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: "Employee Deleted",
        description: "Employee has been deactivated successfully.",
      });

      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleFaceRegistration = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowFaceRegistration(true);
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select employees first",
        variant: "destructive"
      });
      return;
    }

    const count = selectedEmployees.length;
    const confirmMessage = `${action} ${count} employee${count > 1 ? 's' : ''}?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      switch (action) {
        case 'deactivate':
          await supabase
            .from('employees')
            .update({ is_active: false })
            .in('id', selectedEmployees);
          break;
        case 'activate':
          await supabase
            .from('employees')
            .update({ is_active: true })
            .in('id', selectedEmployees);
          break;
      }

      toast({
        title: "Bulk Action Complete",
        description: `Successfully ${action}d ${count} employee${count > 1 ? 's' : ''}`
      });

      setSelectedEmployees([]);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Bulk Action Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const exportEmployees = () => {
    const csv = [
      ['Employee Code', 'Name', 'Email', 'Department', 'Status', 'Face Registered'],
      ...filteredEmployees.map(emp => [
        emp.employee_code,
        emp.full_name,
        emp.email,
        emp.department,
        emp.is_active ? 'Active' : 'Inactive',
        emp.face_registered ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = debouncedSearchTerm === "" || 
      emp.full_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && emp.is_active) ||
      (statusFilter === "inactive" && !emp.is_active);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Employee Management
          </h2>
          <p className="text-muted-foreground text-lg">Manage employee records and face recognition</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingEmployee(null);
              setFormData({
                full_name: "",
                email: "",
                phone: "",
                department: "",
                designation: "",
                hire_date: ""
              });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Update employee information' : 'Enter employee details to add them to the system'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hire_date">Hire Date</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {editingEmployee ? 'Update Employee' : 'Add Employee'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50 shadow-elegant">
        <CardHeader className="pb-6">
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={exportEmployees} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedEmployees.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border">
                <span className="text-sm font-medium">
                  {selectedEmployees.length} employee{selectedEmployees.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('activate')}
                  >
                    Activate
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('deactivate')}
                  >
                    Deactivate
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedEmployees([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{filteredEmployees.length} employees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-green-600" />
                <span>{filteredEmployees.filter(e => e.face_registered).length} with face data</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Employee Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Face Status</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow 
                  key={employee.id}
                  className={selectedEmployees.includes(employee.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedEmployees.includes(employee.id)}
                      onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{employee.employee_code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{employee.full_name}</div>
                      <div className="text-sm text-muted-foreground">{employee.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>
                    <Badge variant={employee.face_registered ? "default" : "secondary"}>
                      {employee.face_registered ? "Registered" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? "default" : "destructive"}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFaceRegistration(employee)}
                        disabled={!employee.is_active}
                        title={employee.face_registered ? "Re-register face" : "Register face"}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(employee)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleFaceRegistration(employee)}
                            disabled={!employee.is_active}
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            {employee.face_registered ? "Re-register Face" : "Register Face"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(employee)}
                            disabled={!employee.is_active}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No employees found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Face Registration Modal */}
      {showFaceRegistration && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <FaceRegistration
            employee={selectedEmployee}
            onComplete={() => {
              setShowFaceRegistration(false);
              setSelectedEmployee(null);
              loadEmployees(); // Refresh the employee list
            }}
            onCancel={() => {
              setShowFaceRegistration(false);
              setSelectedEmployee(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;