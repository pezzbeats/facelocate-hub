import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  LogOut, 
  Clock, 
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";

interface TemporaryExit {
  id: string;
  employee_id: string;
  reason: string;
  estimated_duration_hours: number;
  actual_duration_hours: number | null;
  requested_at: string;
  status: "pending" | "approved" | "denied" | "completed";
  approved_by: string | null;
  denial_reason: string | null;
  approval_time: string | null;
  employee: {
    full_name: string;
    employee_code: string;
    department: string;
  };
  approver?: {
    full_name: string;
  };
}

interface ExitStats {
  pending: number;
  approved_today: number;
  currently_out: number;
  completed: number;
}

const TemporaryExitManagement = () => {
  const [exits, setExits] = useState<TemporaryExit[]>([]);
  const [filteredExits, setFilteredExits] = useState<TemporaryExit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState<ExitStats>({
    pending: 0,
    approved_today: 0,
    currently_out: 0,
    completed: 0
  });
  const [showDenialDialog, setShowDenialDialog] = useState(false);
  const [selectedExit, setSelectedExit] = useState<TemporaryExit | null>(null);
  const [denialReason, setDenialReason] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    loadExits();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [exits, searchTerm, statusFilter]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('temporary_exits_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'temporary_exits' },
        () => {
          loadExits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadExits = async () => {
    try {
      const { data, error } = await supabase
        .from('temporary_exits')
        .select(`
          *,
          employees!inner(
            full_name,
            employee_code,
            department
          ),
          admin_users(
            full_name
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const exitsWithApprover = (data as any[])?.map(exit => ({
        ...exit,
        employee: exit.employees,
        approver: exit.admin_users,
        status: exit.status as "pending" | "approved" | "denied" | "completed"
      })) || [];

      setExits(exitsWithApprover);
      calculateStats(exitsWithApprover);
    } catch (error: any) {
      toast({
        title: "Error Loading Exits",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (exitsData: TemporaryExit[]) => {
    const today = new Date().toDateString();
    
    const stats: ExitStats = {
      pending: exitsData.filter(e => e.status === 'pending').length,
      approved_today: exitsData.filter(e => 
        e.status === 'approved' && 
        e.approval_time &&
        new Date(e.approval_time).toDateString() === today
      ).length,
      currently_out: exitsData.filter(e => 
        e.status === 'approved' && 
        !e.actual_duration_hours
      ).length,
      completed: exitsData.filter(e => e.status === 'completed').length
    };

    setStats(stats);
  };

  const applyFilters = () => {
    let filtered = exits;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(exit =>
        exit.employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exit.employee.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exit.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(exit => exit.status === statusFilter);
    }

    setFilteredExits(filtered);
  };

  const handleApprove = async (exit: TemporaryExit) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('temporary_exits')
        .update({
          status: 'approved',
          approved_by: user.id,
          approval_time: new Date().toISOString()
        })
        .eq('id', exit.id);

      if (error) throw error;

      toast({
        title: "Exit Approved",
        description: `Exit approved for ${exit.employee.full_name}`,
      });

      loadExits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeny = (exit: TemporaryExit) => {
    setSelectedExit(exit);
    setDenialReason("");
    setShowDenialDialog(true);
  };

  const submitDenial = async () => {
    if (!selectedExit || !denialReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for denial",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('temporary_exits')
        .update({
          status: 'denied',
          approved_by: user.id,
          denial_reason: denialReason.trim(),
          approval_time: new Date().toISOString()
        })
        .eq('id', selectedExit.id);

      if (error) throw error;

      toast({
        title: "Exit Denied",
        description: `Exit denied for ${selectedExit.employee.full_name}`,
      });

      setShowDenialDialog(false);
      setSelectedExit(null);
      setDenialReason("");
      loadExits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Temporary Exit Management</h2>
          <p className="text-muted-foreground">Manage employee temporary exit requests and approvals</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{stats.approved_today}</p>
                <p className="text-sm text-muted-foreground">Approved Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <LogOut className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.currently_out}</p>
                <p className="text-sm text-muted-foreground">Currently Out</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Requests</CardTitle>
          <CardDescription>Search and filter temporary exit requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name, code, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exit Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exit Requests</CardTitle>
          <CardDescription>All temporary exit requests requiring action</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExits.map((exit) => (
                <TableRow key={exit.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{exit.employee.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {exit.employee.employee_code} • {exit.employee.department}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={exit.reason}>
                      {exit.reason}
                    </div>
                  </TableCell>
                  <TableCell>
                    {exit.actual_duration_hours ? (
                      <span>{exit.actual_duration_hours.toFixed(1)}h (actual)</span>
                    ) : (
                      <span>{exit.estimated_duration_hours}h (estimated)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {format(new Date(exit.requested_at), 'MMM dd, HH:mm')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(exit.status)}</TableCell>
                  <TableCell>
                    {exit.approver?.full_name || "-"}
                  </TableCell>
                  <TableCell>
                    {exit.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(exit)}
                          className="bg-success hover:bg-success/90"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeny(exit)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Denial Dialog */}
      <Dialog open={showDenialDialog} onOpenChange={setShowDenialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Exit Request</DialogTitle>
            <DialogDescription>
              Provide a reason for denying this temporary exit request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="denial_reason">Reason for Denial *</Label>
              <Textarea
                id="denial_reason"
                placeholder="Please provide a clear reason for denial..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={submitDenial}
                disabled={!denialReason.trim()}
                className="flex-1"
                variant="destructive"
              >
                Deny Request
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDenialDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemporaryExitManagement;