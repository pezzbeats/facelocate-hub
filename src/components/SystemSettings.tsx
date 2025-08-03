import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Clock, 
  Shield, 
  Bell, 
  Palette,
  Eye,
  Loader2
} from "lucide-react";

interface SystemSetting {
  id: string;
  category: string;
  setting_key: string;
  setting_value: any;
  description: string;
  data_type: string;
  is_public: boolean;
}

const SystemSettings = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("attendance");
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true })
        .order('setting_key', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load system settings",
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
        new_value: JSON.stringify(value)
      });

      if (error) throw error;

      // Update local state
      setSettings(prev => prev.map(setting => 
        setting.category === category && setting.setting_key === key
          ? { ...setting, setting_value: value }
          : setting
      ));

      toast({
        title: "Success",
        description: "Setting updated successfully"
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const value = typeof setting.setting_value === 'string' 
      ? JSON.parse(setting.setting_value) 
      : setting.setting_value;

    const handleChange = (newValue: any) => {
      updateSetting(setting.category, setting.setting_key, newValue);
    };

    switch (setting.data_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value}
              onCheckedChange={handleChange}
              disabled={saving}
            />
            <Label>{value ? 'Enabled' : 'Disabled'}</Label>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(Number(e.target.value))}
            disabled={saving}
            className="max-w-xs"
          />
        );

      case 'json':
        return (
          <Textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleChange(parsed);
              } catch (err) {
                // Invalid JSON, don't update
              }
            }}
            disabled={saving}
            rows={4}
          />
        );

      default: // string
        if (setting.setting_key.includes('color')) {
          return (
            <div className="flex items-center space-x-2">
              <Input
                type="color"
                value={value || '#000000'}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                className="w-16 h-10"
              />
              <Input
                type="text"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                className="max-w-xs"
              />
            </div>
          );
        }

        if (setting.setting_key.includes('time')) {
          return (
            <Input
              type="time"
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saving}
              className="max-w-xs"
            />
          );
        }

        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={saving}
            className="max-w-xs"
          />
        );
    }
  };

  const getSettingsByCategory = (category: string) => {
    return settings.filter(setting => setting.category === category);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'attendance': return <Clock className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'notifications': return <Bell className="h-4 w-4" />;
      case 'branding': return <Palette className="h-4 w-4" />;
      case 'face_recognition': return <Eye className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system settings...</span>
      </div>
    );
  }

  const categories = [...new Set(settings.map(s => s.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">
            Configure global system behavior and preferences
          </p>
        </div>
        <Button onClick={loadSettings} variant="outline" disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {categories.map(category => (
            <TabsTrigger key={category} value={category} className="flex items-center gap-2">
              {getCategoryIcon(category)}
              <span className="capitalize">{category.replace('_', ' ')}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {getSettingsByCategory(category).map(setting => (
                  <div key={setting.id} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="font-medium capitalize">
                          {setting.setting_key.replace(/_/g, ' ')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {setting.is_public && (
                          <Badge variant="secondary" className="text-xs">
                            Public
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {setting.data_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="pt-2">
                      {renderSettingInput(setting)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving changes...
        </div>
      )}
    </div>
  );
};

export default SystemSettings;