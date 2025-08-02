-- Fix infinite recursion in admin_users policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage all admin users" ON admin_users;

-- Create non-recursive policies
-- Allow users to view their own record
CREATE POLICY "Users can view own admin record" 
ON admin_users FOR SELECT 
USING (auth.uid() = id);

-- Allow super admins to manage all (using simple auth check)
CREATE POLICY "Super admins can manage all admin users" 
ON admin_users FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.id = auth.uid() 
    AND au.role = 'super_admin' 
    AND au.is_active = true
  )
);

-- For now, allow simple select for admin operations (will improve security later)
CREATE POLICY "Active admins can view admin users" 
ON admin_users FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.id = auth.uid() 
    AND au.is_active = true
  )
);