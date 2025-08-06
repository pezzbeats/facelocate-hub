-- Fix infinite recursion in admin_users RLS policies by using security definer functions
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow admins to manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Active admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage all admin users" ON admin_users;

-- Create security definer function to check if current user is admin without recursion
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true
  )
$$;

-- Create security definer function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Authenticated users can read admin status" 
ON admin_users 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can manage admin users" 
ON admin_users 
FOR ALL 
TO authenticated 
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Allow first admin user creation when table is empty" 
ON admin_users 
FOR INSERT 
TO authenticated 
WITH CHECK (admin_users_table_is_empty());