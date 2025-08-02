import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import jusTrackLogo from "@/assets/justrack-logo.png";

const Setup = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    companyName: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateAdmin = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Please ensure both passwords match.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create the admin user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/dashboard`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Insert admin user record
        const { error: insertError } = await supabase
          .from('admin_users')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.fullName,
            role: 'super_admin'
          });

        if (insertError) throw insertError;

        // Update company name in system config
        const { error: configError } = await supabase
          .from('system_config')
          .update({ config_value: formData.companyName })
          .eq('config_key', 'company_name');

        if (configError) throw configError;

        setStep(2);
        toast({
          title: "Setup Complete!",
          description: "Your admin account has been created successfully.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create admin account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-kiosk">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-success/10 rounded-full w-16 h-16 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription>
              Your JusTrack system is now ready to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-success/5 border border-success/20 rounded-lg p-4">
              <h3 className="font-medium text-success mb-2">What's Next?</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Access your admin dashboard</li>
                <li>• Add locations and register devices</li>
                <li>• Add employees and register faces</li>
                <li>• Start tracking attendance</li>
              </ul>
            </div>
            <Button 
              variant="admin" 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/admin')}
            >
              Go to Admin Dashboard
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-kiosk">
        <CardHeader className="text-center">
          <img src={jusTrackLogo} alt="JusTrack" className="h-12 w-auto mx-auto mb-4" />
          <CardTitle className="text-2xl">System Setup</CardTitle>
          <CardDescription>
            Create your administrator account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Your Company Name"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Administrator Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@company.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              disabled={loading}
            />
          </div>

          <Button 
            variant="admin" 
            size="lg" 
            className="w-full" 
            onClick={handleCreateAdmin}
            disabled={loading || !formData.email || !formData.password || !formData.fullName || !formData.companyName}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Admin Account
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by Shatak Infotech</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;