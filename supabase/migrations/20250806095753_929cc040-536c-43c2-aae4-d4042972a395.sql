-- Create RLS policies for admin_users table to allow authenticated users to check admin status
-- This fixes the hanging authentication issue

-- Policy to allow authenticated users to read admin_users for admin verification
CREATE POLICY "Allow authenticated users to read admin status" 
ON admin_users 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow admin users to manage other admin users
CREATE POLICY "Allow admins to manage admin users" 
ON admin_users 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.id = auth.uid() 
    AND au.is_active = true
  )
);