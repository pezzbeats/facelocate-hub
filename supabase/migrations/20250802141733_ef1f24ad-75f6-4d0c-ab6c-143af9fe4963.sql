-- Fix the chicken and egg problem for first admin user creation
-- Add a policy that allows INSERT when no admin users exist yet

-- Create a function to check if any admin users exist
CREATE OR REPLACE FUNCTION public.admin_users_table_is_empty()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_users LIMIT 1);
$$;

-- Add a policy to allow the first admin user creation
CREATE POLICY "Allow first admin user creation"
ON public.admin_users
FOR INSERT
WITH CHECK (public.admin_users_table_is_empty());

-- Also add a policy to allow users to insert their own admin record if they're authenticated
CREATE POLICY "Users can create their own admin record"
ON public.admin_users
FOR INSERT
WITH CHECK (auth.uid() = id);