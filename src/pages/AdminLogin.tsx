import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BreadcrumbNavigation from "@/components/BreadcrumbNavigation";
import jusTrackLogo from "@/assets/justrack-logo.png";

const AdminLogin = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Verify user is admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', session.user.id)
          .eq('is_active', true)
          .single();
        
        if (adminUser) {
          navigate('/admin/dashboard');
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Verify user is an admin
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single();

        if (adminError || !adminUser) {
          await supabase.auth.signOut();
          throw new Error('Access denied. Admin privileges required.');
        }

        toast({
          title: "Login Successful",
          description: `Welcome back, ${adminUser.full_name}!`,
        });

        navigate('/admin/dashboard');
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-kiosk">
      <BreadcrumbNavigation />
      <div className="flex items-center justify-center p-6 min-h-[calc(100vh-3rem)]">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
      <Card className="w-full max-w-md shadow-elegant border-admin-accent/20 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-primary p-3 shadow-glow">
            <img src={jusTrackLogo} alt="JusTrack" className="w-full h-full object-contain filter brightness-0 invert" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Admin Portal
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Welcome back! Please sign in to your account
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={loading}
                required
                className="h-12 bg-background border-border/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={loading}
                  required
                  className="h-12 bg-background border-border/50 focus:border-primary transition-colors pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-10 w-10 hover:bg-muted/50"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Remember Device */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="rememberDevice" 
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
              />
              <Label htmlFor="rememberDevice" className="text-sm text-muted-foreground">
                Remember this device
              </Label>
            </div>

            <Button 
              type="submit"
              size="lg" 
              className="w-full h-12 bg-gradient-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing In..." : "Sign In to Dashboard"}
            </Button>

            {/* Demo Credentials Info */}
            <Alert className="border-info/20 bg-info/5">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                For testing: Use the credentials created during system setup.
              </AlertDescription>
            </Alert>
          </form>

          <div className="flex flex-col items-center space-y-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            
            <div className="text-center text-xs text-muted-foreground/70">
              <p>Powered by <span className="font-medium">Shatak Infotech</span></p>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;