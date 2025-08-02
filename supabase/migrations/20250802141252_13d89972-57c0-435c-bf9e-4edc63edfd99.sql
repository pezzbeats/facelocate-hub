-- Fix infinite recursion in admin_users RLS policies

-- Step 1: Create security definer functions to check user roles without triggering RLS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT au.role 
  FROM public.admin_users au 
  WHERE au.id = auth.uid() 
  AND au.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users au 
    WHERE au.id = auth.uid() 
    AND au.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users au 
    WHERE au.id = auth.uid() 
    AND au.role = 'super_admin' 
    AND au.is_active = true
  );
$$;

-- Step 2: Drop the problematic policies
DROP POLICY IF EXISTS "Active admins can view admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage all admin users" ON public.admin_users;

-- Step 3: Create new policies using security definer functions
CREATE POLICY "Active admins can view admin users"
ON public.admin_users
FOR SELECT
USING (public.is_active_admin());

CREATE POLICY "Super admins can manage all admin users"
ON public.admin_users
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Step 4: Fix system_config policies that have similar issues
DROP POLICY IF EXISTS "Admins can manage system config" ON public.system_config;
DROP POLICY IF EXISTS "Authenticated users can view system config" ON public.system_config;

CREATE POLICY "Admins can manage system config"
ON public.system_config
FOR ALL
USING (public.is_active_admin())
WITH CHECK (public.is_active_admin());

CREATE POLICY "Authenticated users can view system config"
ON public.system_config
FOR SELECT
USING (public.is_active_admin());