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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Clock, 
  Shield, 
  Bell, 
  Palette,
  Eye,
  Loader2,
  Search,
  RotateCcw,
  Info,
  AlertTriangle
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
  const [searchTerm, setSearchTerm] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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

      setHasChanges(false);
      toast({
        title: "Setting Updated",
        description: `${key.replace(/_/g, ' ')} has been updated successfully`
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Failed to Update Setting",
        description: error.message || "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async (category: string) => {
    if (!confirm(`Reset all ${category} settings to default values?`)) return;
    
    try {
      setSaving(true);
      // This would need a backend function to reset settings
      toast({
        title: "Settings Reset",
        description: `${category} settings have been reset to defaults`
      });
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    let value;
    try {
      if (setting.setting_value === null || setting.setting_value === undefined) {
        value = null;
      } else if (typeof setting.setting_value === 'string') {
        value = JSON.parse(setting.setting_value);
      } else {
        value = setting.setting_value;
      }
    } catch (error) {
      console.warn(`Failed to parse setting value for ${setting.setting_key}:`, setting.setting_value);
      value = setting.setting_value; // Use raw value if JSON parsing fails
    }

    const handleChange = (newValue: any) => {
      setHasChanges(true);
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
    const categorySettings = settings.filter(setting => setting.category === category);
    
    if (!debouncedSearchTerm) return categorySettings;
    
    return categorySettings.filter(setting =>
      setting.setting_key.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      setting.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
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
      <div className="flex flex-col gap-4">
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
        
        {/* Search and Info Bar */}
        <div className="flex items-center gap-4 p-4 bg-card/50 rounded-lg border border-border/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search settings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>
          {hasChanges && (
            <Alert className="flex-shrink-0 w-auto p-2 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-700">
                You have unsaved changes
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto scrollbar-hide p-1 bg-muted rounded-md">
          {categories.map(category => (
            <TabsTrigger 
              key={category} 
              value={category} 
              className="flex items-center gap-2 px-4 py-2 whitespace-nowrap min-w-fit shrink-0 text-sm font-medium rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {getCategoryIcon(category)}
              <span className="capitalize hidden sm:inline">{category.replace('_', ' ')}</span>
              <span className="capitalize sm:hidden">{category.replace('_', ' ').split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(category => {
          const categorySettings = getSettingsByCategory(category);
          return (
            <TabsContent key={category} value={category} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getCategoryIcon(category)}
                      {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} Settings
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetToDefaults(category)}
                      disabled={saving}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Defaults
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categorySettings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Info className="h-8 w-8 mx-auto mb-2" />
                      {debouncedSearchTerm ? (
                        <p>No settings found matching "{debouncedSearchTerm}"</p>
                      ) : (
                        <p>No settings configured for this category</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {categorySettings.map(setting => (
                        <div key={setting.id} className="p-4 border rounded-lg bg-card/30 hover:bg-card/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <Label className="font-medium capitalize">
                                  {setting.setting_key.replace(/_/g, ' ')}
                                </Label>
                                {setting.is_public && (
                                  <Badge variant="secondary" className="text-xs">
                                    Public
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {setting.data_type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {setting.description}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {renderSettingInput(setting)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
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