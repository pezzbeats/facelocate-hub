import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  UserPlus, 
  MapPin, 
  Monitor, 
  FileText, 
  Settings, 
  Plus,
  Search,
  Download,
  Upload
} from "lucide-react";

interface QuickActionsProps {
  onActionClick: (action: string) => void;
}

const QuickActions = ({ onActionClick }: QuickActionsProps) => {
  const quickActions = [
    {
      id: "add-employee",
      label: "Add Employee",
      icon: UserPlus,
      description: "Register new employee",
      variant: "default" as const,
    },
    {
      id: "add-location", 
      label: "Add Location",
      icon: MapPin,
      description: "Create new location",
      variant: "secondary" as const,
    },
    {
      id: "register-device",
      label: "Register Device", 
      icon: Monitor,
      description: "Add new kiosk device",
      variant: "secondary" as const,
    },
    {
      id: "generate-report",
      label: "Generate Report",
      icon: FileText,
      description: "Download attendance report",
      variant: "outline" as const,
    },
    {
      id: "import-employees",
      label: "Import Data",
      icon: Upload,
      description: "Bulk import employees",
      variant: "outline" as const,
    },
    {
      id: "system-settings",
      label: "Settings",
      icon: Settings,
      description: "Configure system",
      variant: "outline" as const,
    },
  ];

  return (
    <Card className="border-border/40 bg-gradient-to-br from-card via-card/95 to-muted/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              className="h-auto p-4 flex flex-col items-start text-left space-y-2 hover:scale-[1.02] transition-all duration-200"
              onClick={() => onActionClick(action.id)}
            >
              <div className="flex items-center gap-2 w-full">
                <action.icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm">{action.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {action.description}
              </p>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;