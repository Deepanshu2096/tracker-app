# Employee Management System

## Overview

- **First-time submission**: Employee fills a fully editable profile form; on submit, profile is marked `submitted`/`active` and becomes read-only. No HR approval.
- **Subsequent updates**: Employee sees read-only profile with a "Request Edit" button. Changes are saved as a **change request** with status `pending_hr_approval`.
- **HR flow**: HR sees pending change requests, compares current vs requested data, and **Approves** (apply to profile, status `approved`) or **Rejects** (keep profile, status `rejected`, store reason for employee).

---

## 1. Database Schema

### 1.1 Profiles (extended)

Table: `public.profiles`

| Column | Type | Description |
|--------|------|-------------|
| `profile_status` | text | `draft` \| `submitted` \| `active`. Default `draft`. |
| (existing) | | id, user_id, email, full_name, role, status, org_id, ... |
| `birthday`, `doj`, `city`, `phone`, `avatar_url` | | Personal/official |
| `gender`, `marital_status`, `address_line1`, `address_line2`, `state`, `pincode`, `personal_email` | | Personal |
| `employee_number`, `department`, `designation`, `work_phone` | | Official |
| `bank_name`, `bank_account_number`, `bank_ifsc`, `bank_branch` | | Bank |
| `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` | | Emergency contact |

- **draft**: First-time not submitted; form is editable.
- **submitted** / **active**: First-time submitted; form is read-only; updates go through change requests.

### 1.2 Change requests

Table: `public.employee_profile_change_requests`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `profile_id` | uuid | FK → profiles(id) |
| `requested_by_user_id` | uuid | Auth user who requested |
| `status` | text | `pending_hr_approval` \| `approved` \| `rejected` |
| `requested_data` | jsonb | Snapshot of requested field values |
| `rejection_reason` | text | Set when HR rejects |
| `reviewed_at` | timestamptz | When HR acted |
| `reviewed_by` | uuid | HR user_id |
| `created_at`, `updated_at` | timestamptz | |

Migration: `supabase/migrations/employee_management_schema.sql`

---

## 2. API / Data Access

The app uses the Supabase client (no separate REST API). Access is via RLS and direct table operations.

### 2.1 Profiles

- **Select**: `profiles` with `profile_status` and extended columns. Filter by `id`, `org_id`, or `user_id`.
- **Update (first-time submit)**:  
  `profiles.update({ ...fields, profile_status: 'submitted' }).eq('id', profileId).eq('org_id', orgId)`
- **Update (HR apply change)**:  
  Same table; HR updates `profiles` with keys from `requested_data` after approving.

### 2.2 Change requests

- **Insert (employee)**:  
  `employee_profile_change_requests.insert({ profile_id, requested_by_user_id, status: 'pending_hr_approval', requested_data })`  
  RLS: employee can insert only for own profile.
- **Select (employee)**:  
  All rows where `profile_id` = current user’s profile (own requests).
- **Select (HR)**:  
  All rows where `status = 'pending_hr_approval'` (and RLS allows HR role).
- **Update (HR)**:  
  Set `status`, `rejection_reason`, `reviewed_at`, `reviewed_by` on approve/reject.

### 2.3 RLS (summary)

- **profiles**: Existing policies; ensure employees can read/update own row as needed.
- **employee_profile_change_requests**:
  - Employees: SELECT own profile’s requests; INSERT for own profile.
  - HR/Admin: SELECT all; UPDATE (approve/reject).

---

## 3. UI Flow

### 3.1 Employee – first time (profile_status = draft)

1. Employee opens **My Profile**.
2. Button: **Complete Profile**.
3. Dialog: full form (name, DOB, DOJ, city, phone, photo, etc.).
4. On **Submit Profile**: call `submitFirstTimeProfile(userId, orgId, data)` → update `profiles` and set `profile_status = 'submitted'`.
5. Profile reloads; form is read-only; button label becomes **Request Edit**.

### 3.2 Employee – after first submit (profile_status = submitted/active)

1. Profile is read-only.
2. Button: **Request Edit**.
3. Dialog: same fields editable; submit creates a **change request**.
4. On **Submit Request**: call `submitChangeRequest(userId, profileId, data)` → insert into `employee_profile_change_requests` with `status: 'pending_hr_approval'`.
5. Employee sees “Your Profile Change Requests” with status (Pending HR / Approved / Rejected) and rejection reason when rejected.

### 3.3 HR – profile change requests

1. HR opens **Profile Requests** (sidebar; roles: hr, admin).
2. List of pending requests: employee name, email, requested at, **Review**.
3. **Review** opens dialog: table with **Field | Current (Approved) | Requested**.
4. **Approve**: apply `requested_data` to `profiles`, set request `status = 'approved'`, `reviewed_at`, `reviewed_by`.
5. **Reject**: set request `status = 'rejected'`, `rejection_reason`, `reviewed_at`, `reviewed_by`; profile unchanged.

---

## 4. Role-Based Access Control

| Role | First-time form | Request Edit | View own profile | View others’ profile | HR Profile Requests |
|------|------------------|--------------|------------------|----------------------|--------------------|
| Employee | ✅ Submit (own) | ✅ Submit request (own) | ✅ | ❌ (or as per existing policy) | ❌ |
| HR | N/A | N/A | ✅ | ✅ (if allowed) | ✅ List, Approve, Reject |
| Admin | N/A | N/A | ✅ | ✅ | ✅ Same as HR |

- **First-time / Request Edit**: Only for **own** profile (`user_id` = auth user).
- **Profile Requests** route: `RoleProtectedRoute` with `allowedRoles: ['hr', 'admin']`.
- RLS on `employee_profile_change_requests` enforces: employees see/insert own; HR/admin see all and update.

---

## 5. Status Summary

| Context | Status | Meaning |
|---------|--------|--------|
| Profile | `draft` | Not yet first-time submitted; form editable. |
| Profile | `submitted` / `active` | First-time submitted; form read-only; updates via change request. |
| Change request | `pending_hr_approval` | Waiting for HR. |
| Change request | `approved` | HR approved; profile updated. |
| Change request | `rejected` | HR rejected; profile unchanged; rejection reason stored and shown to employee. |

---

## 6. Files Touched

- **DB**: `supabase/migrations/employee_management_schema.sql`
- **Stores**: `src/store/profileStore.ts` (profile_status, submitFirstTimeProfile, submitChangeRequest), `src/store/profileChangeRequestStore.ts` (HR + employee requests)
- **UI**: `src/components/pages/EmployeeProfile.tsx` (draft vs submitted, Request Edit, Your change requests), `src/components/pages/EditProfileDialog.tsx` (mode: first_time | edit_request), `src/components/pages/HRProfileRequests.tsx` (HR list + compare + approve/reject)
- **Routes**: `src/routes.tsx` (HR profile requests route), `src/constant/route.ts` (HR_PROFILE_REQUESTS), `src/components/utils/Layout.tsx` (Profile Requests nav for HR/admin)
