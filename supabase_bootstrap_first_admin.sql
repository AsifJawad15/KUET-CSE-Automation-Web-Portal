-- Bootstrap the first web admin account.
-- Edit the values below, then run this in the Supabase SQL Editor.

do $$
declare
  v_email text := lower(trim('__YOUR_ADMIN_EMAIL__'));
  v_password_hash text := '__YOUR_PRIVATE_BCRYPT_HASH__';
  v_full_name text := 'System Administrator';
  v_phone text := null;
  v_department text := 'CSE';
  v_user_id uuid;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or
     v_password_hash !~ '^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$' then
    raise exception 'Set your own administrator email and privately generated bcrypt hash before bootstrap';
  end if;
  select user_id
    into v_user_id
  from public.profiles
  where email = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into public.profiles (
      user_id,
      role,
      email,
      password_hash,
      is_active
    )
    values (
      v_user_id,
      'ADMIN',
      v_email,
      v_password_hash,
      true
    );
  else
    update public.profiles
    set
      role = 'ADMIN',
      password_hash = v_password_hash,
      is_active = true,
      updated_at = now()
    where user_id = v_user_id;
  end if;

  insert into public.staffs (
    user_id,
    full_name,
    phone,
    designation,
    department,
    is_admin
  )
  values (
    v_user_id,
    v_full_name,
    v_phone,
    'Administrator',
    v_department,
    true
  )
  on conflict (user_id) do update
    set
      full_name = excluded.full_name,
      phone = excluded.phone,
      designation = excluded.designation,
      department = excluded.department,
      is_admin = true,
      updated_at = now();

  insert into public.admins (
    user_id,
    full_name,
    phone,
    permissions
  )
  values (
    v_user_id,
    v_full_name,
    v_phone,
    jsonb_build_object('all', true, 'source', 'bootstrap_sql')
  )
  on conflict (user_id) do update
    set
      full_name = excluded.full_name,
      phone = excluded.phone,
      permissions = excluded.permissions,
      updated_at = now();
end $$;
