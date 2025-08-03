import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Book, HelpCircle, Video, FileText, Users, Monitor, MapPin, Clock, Shield } from "lucide-react";

interface HelpTopic {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

const HelpDocumentation = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("getting-started");

  const helpTopics: HelpTopic[] = [
    {
      id: "getting-started",
      title: "Getting Started with JusTrack",
      category: "getting-started",
      content: `Welcome to JusTrack! This guide will help you set up and start using the system.

**Step 1: Initial Setup**
- Log in to the admin dashboard with your credentials
- Add your first location under Location Management
- Register employees and capture their face data
- Set up kiosk devices at your locations

**Step 2: Employee Onboarding**
- Navigate to Employee Management
- Click "Add Employee" and fill in the required information
- Use the face registration feature to capture the employee's face
- Assign the employee to their default location

**Step 3: Device Setup**
- Go to each kiosk location
- Open the device registration page
- Follow the on-screen instructions to register the device
- Test the camera and face recognition functionality`,
      tags: ["setup", "onboarding", "initial", "admin"]
    },
    {
      id: "face-registration",
      title: "How to Register Employee Faces",
      category: "employees",
      content: `Face registration is crucial for accurate attendance tracking.

**Best Practices:**
- Ensure good lighting conditions
- Ask the employee to look directly at the camera
- Capture multiple angles for better accuracy
- Avoid wearing glasses or hats during registration

**Step-by-Step Process:**
1. Go to Employee Management
2. Select the employee
3. Click "Register Face"
4. Position the employee in front of the camera
5. Wait for the green confirmation
6. Test the recognition immediately

**Troubleshooting:**
- If registration fails, try different lighting
- Ensure the camera is working properly
- Clear any obstructions from the face
- Consider re-registering if recognition accuracy is low`,
      tags: ["face", "registration", "employees", "biometric"]
    },
    {
      id: "attendance-process",
      title: "How Attendance Recording Works",
      category: "attendance",
      content: `JusTrack uses intelligent face recognition for seamless attendance tracking.

**Basic Process:**
1. Employee approaches the kiosk
2. Looks at the camera
3. System recognizes the face
4. Automatically determines clock-in or clock-out
5. Confirms the action with audio/visual feedback

**Smart Features:**
- Automatic location transfer detection
- Temporary exit management
- Break time tracking
- Duplicate prevention

**Status Types:**
- Clock In: First arrival of the day
- Clock Out: Departure from current location
- Transfer: Moving between locations
- Temporary Exit: Short absence with return
- Break: Scheduled break time`,
      tags: ["attendance", "clock", "process", "kiosk"]
    },
    {
      id: "location-management",
      title: "Managing Locations and Devices",
      category: "locations",
      content: `Proper location and device management ensures accurate attendance tracking.

**Adding Locations:**
1. Go to Location Management
2. Click "Add Location"
3. Enter location details and address
4. Set GPS coordinates (optional)
5. Configure working hours
6. Activate the location

**Device Registration:**
1. Visit the physical location
2. Open the device registration page
3. Enter device name and select location
4. Allow camera permissions
5. Complete the registration process

**Best Practices:**
- Use descriptive location names
- Set accurate GPS coordinates for mobile apps
- Configure appropriate working hours
- Test devices regularly for connectivity`,
      tags: ["locations", "devices", "setup", "GPS"]
    },
    {
      id: "reports-analytics",
      title: "Understanding Reports and Analytics",
      category: "reports",
      content: `JusTrack provides comprehensive reporting for attendance analysis.

**Available Reports:**
- Daily Attendance: Day-by-day employee presence
- Monthly Summary: Aggregated statistics per employee
- Location Reports: Usage statistics by location
- Department Analysis: Team-wise attendance patterns

**Filtering Options:**
- Date range selection
- Department filtering
- Location-specific reports
- Employee search

**Export Formats:**
- PDF reports for management
- Excel spreadsheets for further analysis
- CSV data for external systems

**Key Metrics:**
- Attendance percentage
- Average working hours
- Punctuality scores
- Location utilization rates`,
      tags: ["reports", "analytics", "export", "statistics"]
    },
    {
      id: "troubleshooting",
      title: "Common Issues and Solutions",
      category: "support",
      content: `Solutions to frequently encountered problems.

**Face Recognition Issues:**
- Problem: Face not recognized
- Solution: Check lighting, clean camera, re-register face

**Device Connection Problems:**
- Problem: Device appears offline
- Solution: Check internet connection, refresh browser, contact IT

**Attendance Discrepancies:**
- Problem: Missing check-ins/outs
- Solution: Review manual logs, check device status during that time

**Performance Issues:**
- Problem: Slow response times
- Solution: Clear browser cache, check internet speed, restart device

**Permission Errors:**
- Problem: Camera access denied
- Solution: Enable camera permissions in browser settings

**For Additional Support:**
- Contact your system administrator
- Check system status on the admin dashboard
- Report issues through the feedback system`,
      tags: ["troubleshooting", "issues", "problems", "support"]
    }
  ];

  const categories = [
    { id: "getting-started", label: "Getting Started", icon: Book },
    { id: "employees", label: "Employee Management", icon: Users },
    { id: "attendance", label: "Attendance Tracking", icon: Clock },
    { id: "locations", label: "Locations & Devices", icon: MapPin },
    { id: "reports", label: "Reports & Analytics", icon: FileText },
    { id: "support", label: "Support & Troubleshooting", icon: HelpCircle }
  ];

  const filteredTopics = helpTopics.filter(topic => {
    const matchesSearch = topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         topic.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         topic.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || topic.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Help & Documentation</h2>
          <p className="text-muted-foreground">Find answers and learn how to use JusTrack effectively</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCategory("getting-started")}>
          <CardContent className="p-6 text-center">
            <Book className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Quick Start Guide</h3>
            <p className="text-sm text-muted-foreground">Get started in minutes</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCategory("support")}>
          <CardContent className="p-6 text-center">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Troubleshooting</h3>
            <p className="text-sm text-muted-foreground">Solve common issues</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <Video className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Video Tutorials</h3>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Documentation Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {category.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Help Topics */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                {filteredTopics.length} topic(s) found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTopics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documentation found matching your search.</p>
                  <p className="text-sm">Try adjusting your search terms or browse by category.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-4">
                  {filteredTopics.map((topic) => (
                    <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full">
                          <h3 className="text-left font-semibold">{topic.title}</h3>
                          <div className="flex gap-1 ml-4">
                            {topic.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="prose prose-sm max-w-none pt-4">
                          {topic.content.split('\n').map((paragraph, index) => {
                            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                              return (
                                <h4 key={index} className="font-semibold text-foreground mt-4 mb-2">
                                  {paragraph.replace(/\*\*/g, '')}
                                </h4>
                              );
                            }
                            if (paragraph.startsWith('- ')) {
                              return (
                                <li key={index} className="text-muted-foreground ml-4">
                                  {paragraph.substring(2)}
                                </li>
                              );
                            }
                            if (paragraph.match(/^\d+\./)) {
                              return (
                                <li key={index} className="text-muted-foreground ml-4 list-decimal">
                                  {paragraph.replace(/^\d+\.\s*/, '')}
                                </li>
                              );
                            }
                            if (paragraph.trim()) {
                              return (
                                <p key={index} className="text-muted-foreground mb-2">
                                  {paragraph}
                                </p>
                              );
                            }
                            return <br key={index} />;
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HelpDocumentation;