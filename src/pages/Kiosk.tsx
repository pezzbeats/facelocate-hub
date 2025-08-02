import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  Camera, 
  MapPin, 
  Clock, 
  User, 
  Settings,
  Wifi,
  WifiOff
} from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

const Kiosk = () => {
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    name: "",
    location: "",
    isOnline: true
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Check if device is registered
    // This will be implemented with actual device registration logic
    const deviceId = localStorage.getItem('justrack_device_id');
    if (!deviceId) {
      navigate('/kiosk/register');
    } else {
      setIsDeviceRegistered(true);
      // Load device info from storage/API
      setDeviceInfo({
        name: localStorage.getItem('justrack_device_name') || 'Kiosk Device',
        location: localStorage.getItem('justrack_device_location') || 'Unknown Location',
        isOnline: true
      });
    }
  }, [navigate]);

  const currentTime = new Date().toLocaleString();

  if (!isDeviceRegistered) {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking device registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-kiosk">
      {/* Kiosk Header */}
      <header className="bg-card border-b border-border shadow-elegant">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={jusTrackLogo} alt="JusTrack" className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-foreground">JusTrack Kiosk</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{deviceInfo.location}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{currentTime}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {deviceInfo.isOnline ? (
                    <>
                      <Wifi className="h-3 w-3 text-success" />
                      <span>Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-destructive" />
                      <span>Offline</span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/kiosk/register')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Interface */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Face Recognition Attendance
            </h2>
            <p className="text-lg text-muted-foreground">
              Position your face in the camera view and wait for recognition
            </p>
          </div>

          {/* Camera Interface Card */}
          <Card className="mb-8 shadow-kiosk border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                <Camera className="h-6 w-6" />
                Face Recognition Scanner
              </CardTitle>
              <CardDescription>
                Look directly at the camera for best results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Camera View Placeholder */}
              <div className="aspect-video bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center mb-6">
                <div className="text-center">
                  <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Camera will activate here</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Face recognition module will be implemented in next phase
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="kiosk-success"
                  size="kiosk"
                  className="w-full"
                >
                  <Clock className="h-6 w-6 mr-2" />
                  Clock In
                </Button>
                <Button
                  variant="kiosk"
                  size="kiosk"
                  className="w-full"
                >
                  <Clock className="h-6 w-6 mr-2" />
                  Clock Out
                </Button>
              </div>

              {/* Additional Actions */}
              <div className="mt-4 grid grid-cols-1 gap-2">
                <Button
                  variant="kiosk-outline"
                  size="kiosk-sm"
                  className="w-full"
                >
                  <User className="h-5 w-5 mr-2" />
                  Request Temporary Exit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Information */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-success/5 border-success/20">
              <CardContent className="pt-4">
                <div className="text-center">
                  <Badge variant="outline" className="border-success text-success mb-2">
                    System Status
                  </Badge>
                  <p className="text-sm font-medium">Face Recognition Active</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="text-center">
                  <Badge variant="outline" className="border-primary text-primary mb-2">
                    Location
                  </Badge>
                  <p className="text-sm font-medium">{deviceInfo.location}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <Badge variant="outline" className="mb-2">
                    Device
                  </Badge>
                  <p className="text-sm font-medium">{deviceInfo.name}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <Card className="mt-6 bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Instructions:</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Stand directly in front of the camera</p>
                <p>• Remove glasses or hats if possible</p>
                <p>• Ensure good lighting on your face</p>
                <p>• Wait for the green confirmation</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-8 py-4">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Powered by Shatak Infotech • JusTrack Simplified v1.0</p>
        </div>
      </footer>
    </div>
  );
};

export default Kiosk;