-- Create system settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- 'attendance', 'security', 'notifications', 'branding'
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    description TEXT,
    data_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    is_public BOOLEAN DEFAULT false, -- Whether setting can be accessed by non-admins
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.admin_users(id),
    UNIQUE(category, setting_key)
);

-- Create user sessions table for tracking admin activity
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.admin_users(id),
    session_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    logout_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit log table for tracking all admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.admin_users(id),
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout'
    table_name TEXT, -- Which table was affected
    record_id UUID, -- ID of the affected record
    old_values JSONB, -- Previous values (for updates/deletes)
    new_values JSONB, -- New values (for creates/updates)
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system notifications table
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_users TEXT[] DEFAULT '{}', -- Array of user roles or 'all'
    is_read BOOLEAN DEFAULT false,
    read_by UUID[] DEFAULT '{}', -- Array of user IDs who have read it
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.admin_users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for system_settings
CREATE POLICY "Super admins can manage system settings"
ON public.system_settings FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Admins can view system settings"
ON public.system_settings FOR SELECT
USING (is_active_admin());

CREATE POLICY "Public settings can be viewed by all"
ON public.system_settings FOR SELECT
USING (is_public = true);

-- Create policies for user_sessions
CREATE POLICY "Admins can view their own sessions"
ON public.user_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (is_super_admin());

CREATE POLICY "System can manage sessions"
ON public.user_sessions FOR ALL
WITH CHECK (true);

-- Create policies for audit_logs
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs FOR SELECT
USING (is_super_admin());

CREATE POLICY "Admins can view their own actions"
ON public.audit_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Create policies for system_notifications
CREATE POLICY "Admins can view notifications for their role"
ON public.system_notifications FOR SELECT
USING (
    'all' = ANY(target_users) OR 
    get_current_user_role() = ANY(target_users) OR
    auth.uid() = ANY(read_by)
);

CREATE POLICY "Super admins can manage all notifications"
ON public.system_notifications FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Create triggers for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default system settings
INSERT INTO public.system_settings (category, setting_key, setting_value, description, data_type, is_public) VALUES
('attendance', 'working_hours_start', '"09:00"', 'Default working hours start time', 'string', true),
('attendance', 'working_hours_end', '"17:00"', 'Default working hours end time', 'string', true),
('attendance', 'late_threshold_minutes', '15', 'Minutes after start time considered late', 'number', true),
('attendance', 'auto_approve_temp_exit_hours', '2', 'Hours for auto-approval of temporary exits', 'number', false),
('security', 'session_timeout_minutes', '480', 'Session timeout in minutes (8 hours)', 'number', false),
('security', 'max_login_attempts', '5', 'Maximum failed login attempts before lockout', 'number', false),
('security', 'password_min_length', '8', 'Minimum password length', 'number', false),
('notifications', 'email_enabled', 'true', 'Enable email notifications', 'boolean', false),
('notifications', 'push_enabled', 'true', 'Enable push notifications', 'boolean', false),
('branding', 'company_name', '"Shatak Infotech"', 'Company name', 'string', true),
('branding', 'app_title', '"JusTrack Simplified"', 'Application title', 'string', true),
('branding', 'primary_color', '"#2563eb"', 'Primary brand color', 'string', true),
('face_recognition', 'confidence_threshold', '0.85', 'Minimum confidence for face recognition', 'number', false),
('face_recognition', 'quality_threshold', '0.7', 'Minimum face quality threshold', 'number', false)
ON CONFLICT (category, setting_key) DO NOTHING;

-- Create function to get system setting
CREATE OR REPLACE FUNCTION public.get_system_setting(
    setting_category TEXT,
    setting_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    setting_value JSONB;
BEGIN
    SELECT s.setting_value INTO setting_value
    FROM public.system_settings s
    WHERE s.category = setting_category 
    AND s.setting_key = setting_key;
    
    RETURN setting_value;
END;
$$;

-- Create function to update system setting
CREATE OR REPLACE FUNCTION public.update_system_setting(
    setting_category TEXT,
    setting_key TEXT,
    new_value JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Check if user is super admin
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Super admin required.';
    END IF;
    
    UPDATE public.system_settings 
    SET setting_value = new_value,
        updated_at = now()
    WHERE category = setting_category 
    AND setting_key = setting_key;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, new_values
    ) VALUES (
        auth.uid(), 
        'update', 
        'system_settings', 
        null,
        jsonb_build_object('category', setting_category, 'key', setting_key, 'value', new_value)
    );
    
    RETURN true;
END;
$$;

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    action_type TEXT,
    target_table TEXT DEFAULT null,
    target_id UUID DEFAULT null,
    old_data JSONB DEFAULT null,
    new_data JSONB DEFAULT null
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        auth.uid(),
        action_type,
        target_table,
        target_id,
        old_data,
        new_data,
        inet_client_addr()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;