import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, 
  Ear, 
  Type, 
  MousePointer, 
  Keyboard, 
  Monitor,
  Sun,
  Moon,
  Contrast,
  Volume2,
  Accessibility
} from "lucide-react";

interface AccessibilitySettings {
  fontSize: number;
  fontFamily: string;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  voiceAnnouncements: boolean;
  colorScheme: 'light' | 'dark' | 'auto';
  focusIndicators: boolean;
  largeClickTargets: boolean;
  speechRate: number;
  speechVolume: number;
}

const AccessibilitySettings = () => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<AccessibilitySettings>({
    fontSize: 100,
    fontFamily: 'default',
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
    voiceAnnouncements: false,
    colorScheme: 'auto',
    focusIndicators: true,
    largeClickTargets: false,
    speechRate: 1,
    speechVolume: 0.8
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibilitySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        applySettings(parsed);
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
    }
  }, []);

  // Apply settings to the document
  const applySettings = (newSettings: AccessibilitySettings) => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = `${newSettings.fontSize}%`;
    
    // Font family
    if (newSettings.fontFamily !== 'default') {
      root.style.fontFamily = newSettings.fontFamily;
    }
    
    // High contrast
    if (newSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Reduced motion
    if (newSettings.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // Large click targets
    if (newSettings.largeClickTargets) {
      root.classList.add('large-targets');
    } else {
      root.classList.remove('large-targets');
    }
    
    // Focus indicators
    if (newSettings.focusIndicators) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }
    
    // Color scheme
    root.setAttribute('data-theme', newSettings.colorScheme);
  };

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K, 
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    applySettings(newSettings);
    
    // Save to localStorage
    localStorage.setItem('accessibilitySettings', JSON.stringify(newSettings));
    
    toast({
      title: "Settings Updated",
      description: "Accessibility settings have been applied.",
    });
  };

  const resetToDefaults = () => {
    const defaultSettings: AccessibilitySettings = {
      fontSize: 100,
      fontFamily: 'default',
      highContrast: false,
      reducedMotion: false,
      screenReader: false,
      keyboardNavigation: true,
      voiceAnnouncements: false,
      colorScheme: 'auto',
      focusIndicators: true,
      largeClickTargets: false,
      speechRate: 1,
      speechVolume: 0.8
    };
    
    setSettings(defaultSettings);
    applySettings(defaultSettings);
    localStorage.setItem('accessibilitySettings', JSON.stringify(defaultSettings));
    
    toast({
      title: "Settings Reset",
      description: "All accessibility settings have been reset to defaults.",
    });
  };

  const testScreenReader = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        "Screen reader test successful. All accessibility features are working properly."
      );
      utterance.rate = settings.speechRate;
      utterance.volume = settings.speechVolume;
      speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Screen Reader Unavailable",
        description: "Speech synthesis is not supported in this browser.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accessibility Settings</h2>
          <p className="text-muted-foreground">Customize the interface for better accessibility</p>
        </div>
        <Button variant="outline" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
      </div>

      {/* Quick Accessibility Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Accessibility className="h-5 w-5" />
            Current Accessibility Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {settings.highContrast && <Badge>High Contrast</Badge>}
            {settings.reducedMotion && <Badge>Reduced Motion</Badge>}
            {settings.largeClickTargets && <Badge>Large Targets</Badge>}
            {settings.voiceAnnouncements && <Badge>Voice Enabled</Badge>}
            {settings.fontSize !== 100 && <Badge>Custom Font Size</Badge>}
            {settings.fontFamily !== 'default' && <Badge>Custom Font</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Visual Settings
            </CardTitle>
            <CardDescription>Adjust visual presentation for better readability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Font Size: {settings.fontSize}%</Label>
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) => updateSetting('fontSize', value)}
                min={75}
                max={150}
                step={5}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Adjust text size for better readability
              </p>
            </div>

            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select value={settings.fontFamily} onValueChange={(value) => updateSetting('fontFamily', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Inter)</SelectItem>
                  <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                  <SelectItem value="'Courier New', monospace">Courier New (Monospace)</SelectItem>
                  <SelectItem value="Georgia, serif">Georgia (Serif)</SelectItem>
                  <SelectItem value="'Open Dyslexic', sans-serif">OpenDyslexic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color Scheme</Label>
              <Select value={settings.colorScheme} onValueChange={(value: 'light' | 'dark' | 'auto') => updateSetting('colorScheme', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Auto (System)
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>High Contrast Mode</Label>
                <p className="text-sm text-muted-foreground">Increases contrast for better visibility</p>
              </div>
              <Switch
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSetting('highContrast', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Reduced Motion</Label>
                <p className="text-sm text-muted-foreground">Reduces animations and transitions</p>
              </div>
              <Switch
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Interaction Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Interaction Settings
            </CardTitle>
            <CardDescription>Configure input and navigation preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Large Click Targets</Label>
                <p className="text-sm text-muted-foreground">Makes buttons and links larger</p>
              </div>
              <Switch
                checked={settings.largeClickTargets}
                onCheckedChange={(checked) => updateSetting('largeClickTargets', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enhanced Focus Indicators</Label>
                <p className="text-sm text-muted-foreground">Clearer focus outlines for keyboard navigation</p>
              </div>
              <Switch
                checked={settings.focusIndicators}
                onCheckedChange={(checked) => updateSetting('focusIndicators', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Keyboard Navigation</Label>
                <p className="text-sm text-muted-foreground">Enable full keyboard navigation support</p>
              </div>
              <Switch
                checked={settings.keyboardNavigation}
                onCheckedChange={(checked) => updateSetting('keyboardNavigation', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Audio Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Audio Settings
            </CardTitle>
            <CardDescription>Configure voice announcements and audio feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Voice Announcements</Label>
                <p className="text-sm text-muted-foreground">Speak important notifications aloud</p>
              </div>
              <Switch
                checked={settings.voiceAnnouncements}
                onCheckedChange={(checked) => updateSetting('voiceAnnouncements', checked)}
              />
            </div>

            {settings.voiceAnnouncements && (
              <>
                <div className="space-y-2">
                  <Label>Speech Rate: {settings.speechRate}x</Label>
                  <Slider
                    value={[settings.speechRate]}
                    onValueChange={([value]) => updateSetting('speechRate', value)}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Speech Volume: {Math.round(settings.speechVolume * 100)}%</Label>
                  <Slider
                    value={[settings.speechVolume]}
                    onValueChange={([value]) => updateSetting('speechVolume', value)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <Button onClick={testScreenReader} variant="outline" className="w-full">
                  Test Voice Announcements
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Screen Reader Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ear className="h-5 w-5" />
              Screen Reader Support
            </CardTitle>
            <CardDescription>Optimize for screen reader compatibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Screen Reader Mode</Label>
                <p className="text-sm text-muted-foreground">Optimizes interface for screen readers</p>
              </div>
              <Switch
                checked={settings.screenReader}
                onCheckedChange={(checked) => updateSetting('screenReader', checked)}
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Keyboard Shortcuts</h4>
              <div className="text-sm space-y-1">
                <p><kbd className="px-2 py-1 bg-background rounded">Tab</kbd> - Navigate forward</p>
                <p><kbd className="px-2 py-1 bg-background rounded">Shift+Tab</kbd> - Navigate backward</p>
                <p><kbd className="px-2 py-1 bg-background rounded">Enter/Space</kbd> - Activate element</p>
                <p><kbd className="px-2 py-1 bg-background rounded">Esc</kbd> - Close dialogs</p>
                <p><kbd className="px-2 py-1 bg-background rounded">Arrow Keys</kbd> - Navigate menus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccessibilitySettings;