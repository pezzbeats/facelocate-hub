import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Monitor, Settings, Users, Clock } from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-kiosk">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-elegant">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={jusTrackLogo} alt="JusTrack" className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-foreground">JusTrack Simplified</h1>
                <p className="text-sm text-muted-foreground">Powered by Shatak Infotech</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Face Recognition Attendance System</p>
              <p className="text-xs text-muted-foreground">Professional Edition</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Welcome to JusTrack Simplified
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced face recognition attendance tracking system with smart location-based monitoring. 
            Choose your interface below to get started.
          </p>
        </div>

        {/* Interface Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Kiosk Interface Card */}
          <Card className="group hover:shadow-kiosk transition-all duration-300 border-2 hover:border-primary cursor-pointer transform hover:scale-105">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Monitor className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl">Employee Kiosk</CardTitle>
              <CardDescription className="text-base">
                Face recognition attendance interface for employees to clock in/out
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Smart clock in/out detection</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Face recognition technology</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Touch-friendly interface</span>
                </div>
              </div>
              <Button 
                variant="kiosk" 
                size="kiosk" 
                className="w-full"
                onClick={() => navigate('/kiosk')}
              >
                Launch Kiosk Interface
              </Button>
            </CardContent>
          </Card>

          {/* Admin Interface Card */}
          <Card className="group hover:shadow-kiosk transition-all duration-300 border-2 hover:border-primary cursor-pointer transform hover:scale-105">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Settings className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
              <CardDescription className="text-base">
                Management interface for administrators and HR personnel
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Employee management</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Device registration</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Real-time monitoring</span>
                </div>
              </div>
              <Button 
                variant="admin" 
                size="kiosk" 
                className="w-full"
                onClick={() => navigate('/admin')}
              >
                Access Admin Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div className="mt-12 text-center">
          <Card className="max-w-md mx-auto bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-success">
                <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                <span className="font-medium">System Online</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                All systems operational • Face recognition active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <div className="border-t border-border pt-6">
            <p>&copy; 2025 Shatak Infotech. All rights reserved.</p>
            <p className="mt-1">JusTrack Simplified v1.0 • Professional Attendance Management System</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Landing;