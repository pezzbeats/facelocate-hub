-- Fix the trigger function to return proper trigger type
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Prevent non-super admins from creating/modifying super admin roles
    IF NEW.role = 'super_admin' AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Cannot create or modify super admin roles.';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to prevent privilege escalation
DROP TRIGGER IF EXISTS prevent_admin_privilege_escalation ON public.admin_users;
CREATE TRIGGER prevent_admin_privilege_escalation
    BEFORE INSERT OR UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_privilege_escalation();

-- Add unique constraint for rate limits
ALTER TABLE public.security_rate_limits 
ADD CONSTRAINT unique_user_operation 
UNIQUE (user_id, operation_type);