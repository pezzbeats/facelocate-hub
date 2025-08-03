import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle, AlertTriangle, Info, X } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  target_users: string[];
  expires_at?: string;
}

const NotificationToast = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to new notifications
    const channel = supabase
      .channel('system_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_notifications'
      }, (payload) => {
        const notification = payload.new as Notification;
        
        // Check if notification targets current user
        if (notification.target_users.includes('all') || 
            notification.target_users.includes('admin')) {
          showToast(notification);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showToast = (notification: Notification) => {
    const getIcon = (type: string) => {
      switch (type) {
        case 'success': return CheckCircle;
        case 'warning': return AlertTriangle;
        case 'error': return X;
        case 'info': 
        default: return Info;
      }
    };

    const Icon = getIcon(notification.type);

    toast(notification.title, {
      description: notification.message,
      icon: <Icon className="h-4 w-4" />,
      duration: 5000,
      action: {
        label: "Dismiss",
        onClick: () => {},
      },
    });
  };

  return null; // This component doesn't render anything visible
};

export default NotificationToast;