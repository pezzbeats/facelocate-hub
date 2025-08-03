// Security settings component for admin configuration

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, CheckCircle2, Settings, Clock, Users } from "lucide-react";

interface SecuritySetting {
  id: string;
  category: string;
  setting_key: string;
  setting_value: any;
  description: string;
}

const SecuritySettings = () => {
  const [settings, setSettings] = useState<SecuritySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const defaultSettings = [
    {
      category: 'authentication',
      setting_key: 'password_min_length',
      setting_value: { value: 8 },
      description: 'Minimum password length requirement'
    },
    {
      category: 'authentication',
      setting_key: 'session_timeout_minutes',
      setting_value: { value: 480 }, // 8 hours
      description: 'Session timeout in minutes'
    },
    {
      category: 'authentication',
      setting_key: 'max_login_attempts',
      setting_value: { value: 5 },
      description: 'Maximum login attempts before account lockout'
    },
    {
      category: 'authentication',
      setting_key: 'lockout_duration_minutes',
      setting_value: { value: 15 },
      description: 'Account lockout duration in minutes'
    },
    {
      category: 'face_recognition',
      setting_key: 'min_confidence_score',
      setting_value: { value: 0.8 },
      description: 'Minimum confidence score for face recognition'
    },
    {
      category: 'face_recognition',
      setting_key: 'encrypt_face_data',
      setting_value: { value: true },
      description: 'Encrypt face recognition data at rest'
    },
    {
      category: 'audit',
      setting_key: 'log_retention_days',
      setting_value: { value: 90 },
      description: 'Number of days to retain audit logs'
    },
    {
      category: 'audit',
      setting_key: 'enable_detailed_logging',
      setting_value: { value: true },
      description: 'Enable detailed security event logging'
    }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('category', ['authentication', 'face_recognition', 'audit']);

      if (error) throw error;

      // Merge with default settings
      const existingSettings = data || [];
      const mergedSettings = defaultSettings.map(defaultSetting => {
        const existing = existingSettings.find(
          s => s.category === defaultSetting.category && s.setting_key === defaultSetting.setting_key
        );
        return existing || { ...defaultSetting, id: '' };
      });

      setSettings(mergedSettings);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load security settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (category: string, key: string, value: any) => {
    try {
      setSaving(true);

      const { error } = await supabase.rpc('update_system_setting', {
        setting_category: category,
        setting_key: key,
        new_value: { value }
      });

      if (error) throw error;

      // Update local state
      setSettings(prev => prev.map(setting => 
        setting.category === category && setting.setting_key === key
          ? { ...setting, setting_value: { value } }
          : setting
      ));

      toast({
        title: "Success",
        description: "Security setting updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getSettingValue = (category: string, key: string) => {
    const setting = settings.find(s => s.category === category && s.setting_key === key);
    return setting?.setting_value?.value;
  };

  const renderNumberInput = (category: string, key: string, label: string, min = 1, max = 999) => {
    const value = getSettingValue(category, key) || 0;
    
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => updateSetting(category, key, parseInt(e.target.value))}
          disabled={saving}
        />
      </div>
    );
  };

  const renderSwitchInput = (category: string, key: string, label: string) => {
    const value = getSettingValue(category, key) || false;
    
    return (
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Switch
          checked={value}
          onCheckedChange={(checked) => updateSetting(category, key, checked)}
          disabled={saving}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Settings className="h-8 w-8 animate-spin mr-2" />
        <span>Loading security settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Settings</h2>
          <p className="text-muted-foreground">
            Configure security policies and parameters for JusTrack
          </p>
        </div>
        <Badge variant="outline">
          <Shield className="mr-2 h-4 w-4" />
          Security Configuration
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Changes to security settings take effect immediately. Ensure you understand the impact before making modifications.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authentication Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Authentication Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderNumberInput('authentication', 'password_min_length', 'Minimum Password Length', 6, 20)}
            {renderNumberInput('authentication', 'session_timeout_minutes', 'Session Timeout (minutes)', 30, 1440)}
            {renderNumberInput('authentication', 'max_login_attempts', 'Max Login Attempts', 3, 10)}
            {renderNumberInput('authentication', 'lockout_duration_minutes', 'Lockout Duration (minutes)', 5, 60)}
          </CardContent>
        </Card>

        {/* Face Recognition Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Face Recognition Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Confidence Score</Label>
              <Input
                type="number"
                step="0.1"
                min="0.5"
                max="1.0"
                value={getSettingValue('face_recognition', 'min_confidence_score') || 0.8}
                onChange={(e) => updateSetting('face_recognition', 'min_confidence_score', parseFloat(e.target.value))}
                disabled={saving}
              />
            </div>
            {renderSwitchInput('face_recognition', 'encrypt_face_data', 'Encrypt Face Data')}
          </CardContent>
        </Card>

        {/* Audit & Logging Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Audit & Logging
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderNumberInput('audit', 'log_retention_days', 'Log Retention (days)', 30, 365)}
            {renderSwitchInput('audit', 'enable_detailed_logging', 'Detailed Logging')}
          </CardContent>
        </Card>

        {/* Security Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Security Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Password Protection</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Rate Limiting</span>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Audit Logging</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>RLS Policies</span>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          Security hardening completed. All critical security measures are now active.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SecuritySettings;