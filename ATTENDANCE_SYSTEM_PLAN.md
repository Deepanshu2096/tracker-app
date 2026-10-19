# Comprehensive Attendance & Employee Management System Implementation Plan

## Overview
This plan covers the implementation of a complete attendance and employee management system with role-based access, Check-In/Check-Out functionality, leave management, and enhanced dashboard features.

## Phase 1: Role-Based Access Control & Data Filtering

### 1.1 Update Profile Filtering Logic
- **File**: `src/store/teamStore.ts`
- **Changes**:
  - Manager/TL: Filter profiles by `team_members` JSON field (already implemented)
  - Employee: Show only their own profile
  - Admin: Show all profiles (already implemented)

### 1.2 Update Dashboard Access
- **File**: `src/components/pages/Dashboard.tsx`
- **Changes**:
  - Manager/TL: Show stats only for their team members
  - Employee: Show only their own stats
  - Admin: Show organization-wide stats

## Phase 2: Check-In/Check-Out System

### 2.1 Database Migration
- **File**: `supabase/migrations/add_checkin_checkout_attendance.sql`
- **Changes**:
  - Ensure `attendance` table has `check_in` and `check_out` timestamp fields
  - Add constraint: Cannot check-out without check-in
  - Add status field: 'checked_in', 'checked_out', 'on_break'

### 2.2 Create Check-In/Check-Out Store
- **File**: `src/store/checkInOutStore.ts` (NEW)
- **Features**:
  - `checkIn()` - Create attendance record with check_in timestamp
  - `checkOut()` - Update attendance record with check_out timestamp
  - `getCurrentStatus()` - Get current attendance status
  - Validation: Cannot check-out without check-in
  - Validation: Cannot check-in twice in same day

### 2.3 Create Check-In/Check-Out Component
- **File**: `src/components/pages/CheckInOut.tsx` (NEW)
- **Features**:
  - Separate "Check-In" button (green, prominent)
  - Separate "Check-Out" button (red, prominent)
  - Disable Check-Out if not checked in
  - Show current status badge
  - Display check-in/check-out timestamps
  - Show today's working hours

### 2.4 Update Attendance Store
- **File**: `src/store/attendanceStore.ts`
- **Changes**:
  - Add methods for check-in/check-out
  - Track current attendance status
  - Calculate daily working hours (8/9 hours)

## Phase 3: Employee Detail View

### 3.1 Update Employee Profile Component
- **File**: `src/components/pages/EmployeeProfile.tsx`
- **Changes**:
  - Display Employee ID (database ID)
  - Show First Name, Last Name, Full Name
  - Display Date of Birth
  - Display Joining Date
  - Show Department (team name)
  - Show Location (city)
  - Display Current Work Status (Online/Offline/Break/In Meeting)

### 3.2 Add Employee Click Handler
- **File**: `src/components/pages/Team.tsx`
- **Changes**:
  - Make employee rows clickable
  - Navigate to employee detail view
  - Pass employee ID as parameter

## Phase 4: Search & Filtering

### 4.1 Add Employee ID Search
- **File**: `src/components/pages/Team.tsx`
- **Changes**:
  - Add search input field
  - Filter by Employee ID (database ID)
  - Filter by name, email
  - Manager/TL can search their team members

### 4.2 Active Session Checker
- **File**: `src/components/pages/Team.tsx` or new component
- **Features**:
  - Show active session indicator for each employee
  - Real-time status updates
  - Filter by active/inactive status

## Phase 5: Leave Management System

### 5.1 Database Migration
- **File**: `supabase/migrations/create_leave_management.sql` (NEW)
- **Changes**:
  - Create `leave_requests` table:
    - id, user_id, leave_type, start_date, end_date, duration_days, duration_type (full/half), status (pending/approved/rejected), reason, approved_by, created_at, updated_at
  - Create `leave_types` enum or table:
    - Sick, Personal, Maternity, Paternity, Comp-off, Unpaid
  - Create `leave_history` view or table for tracking

### 5.2 Create Leave Management Store
- **File**: `src/store/leaveStore.ts` (NEW)
- **Features**:
  - `requestLeave()` - Create leave request
  - `getLeaveHistory()` - Get employee's leave history
  - `getPendingRequests()` - Get pending requests (for managers)
  - `approveLeave()` - Approve leave request
  - `rejectLeave()` - Reject leave request
  - Support single-day, multi-day, half-day

### 5.3 Create Leave Management Components
- **File**: `src/components/pages/LeaveManagement.tsx` (NEW)
- **Features**:
  - Employee view: Request leave, view history
  - Manager view: Approve/reject requests, view team leave calendar
  - Leave request form with date picker
  - Leave type selector
  - Half-day option
  - Leave calendar view

### 5.4 Add Leave Routes
- **File**: `src/routes.tsx`
- **Changes**:
  - Add route for leave management page

## Phase 6: Enhanced Dashboard & Attendance

### 6.1 Update Dashboard Stats
- **File**: `src/components/pages/Dashboard.tsx`
- **Changes**:
  - Total employees (role-based filtered)
  - Active sessions (checked-in users)
  - Total present today (checked-in and not checked-out)
  - Total on leave (users with approved leave today)

### 6.2 Attendance Calculation
- **File**: `src/store/attendanceStore.ts`
- **Changes**:
  - Calculate attendance based on Check-In/Check-Out
  - Track daily working hours (8/9 hours)
  - Mark full-day if >= 8 hours
  - Mark half-day if >= 4 hours
  - Mark absent if no check-in

### 6.3 Attendance Dashboard Component
- **File**: `src/components/pages/Attendance.tsx` (UPDATE)
- **Changes**:
  - Show attendance based on check-in/check-out
  - Display working hours per day
  - Show attendance calendar
  - Filter by date range

## Phase 7: Session & Productivity Tracking

### 7.1 Update Session History
- **File**: `src/components/pages/SessionHistory.tsx`
- **Changes**:
  - Summary view by default
  - Detailed logs on click/expand
  - Track working time, break time
  - Productivity metrics

### 7.2 Add Productivity Tracking
- **File**: `src/store/productivityStore.ts` (NEW)
- **Features**:
  - Track active work time vs break time
  - Calculate productivity percentage
  - Daily/weekly/monthly reports

## Implementation Order

1. **Phase 1**: Role-based access (foundation)
2. **Phase 2**: Check-In/Check-Out system (core functionality)
3. **Phase 3**: Employee detail view (user experience)
4. **Phase 4**: Search & filtering (usability)
5. **Phase 5**: Leave management (feature completeness)
6. **Phase 6**: Enhanced dashboard (reporting)
7. **Phase 7**: Productivity tracking (advanced features)

## Files to Create

1. `src/store/checkInOutStore.ts` - Check-in/check-out state management
2. `src/store/leaveStore.ts` - Leave management state
3. `src/store/productivityStore.ts` - Productivity tracking
4. `src/components/pages/CheckInOut.tsx` - Check-in/check-out UI
5. `src/components/pages/LeaveManagement.tsx` - Leave management UI
6. `supabase/migrations/add_checkin_checkout_attendance.sql` - Database schema
7. `supabase/migrations/create_leave_management.sql` - Leave tables

## Files to Modify

1. `src/store/teamStore.ts` - Role-based filtering
2. `src/store/attendanceStore.ts` - Check-in/check-out integration
3. `src/components/pages/Dashboard.tsx` - Enhanced stats
4. `src/components/pages/Team.tsx` - Search, filtering, click handlers
5. `src/components/pages/EmployeeProfile.tsx` - Enhanced detail view
6. `src/components/pages/Attendance.tsx` - Check-in/check-out based attendance
7. `src/components/pages/SessionHistory.tsx` - Summary/detail views
8. `src/routes.tsx` - New routes

## Database Schema Requirements

### Attendance Table (verify/modify)
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- check_in (timestamp)
- check_out (timestamp, nullable)
- date (date)
- duration_minutes (integer, nullable)
- status (enum: 'checked_in', 'checked_out', 'on_break')
- created_at, updated_at
```

### Leave Requests Table (new)
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to profiles)
- leave_type (enum: 'sick', 'personal', 'maternity', 'paternity', 'comp_off', 'unpaid')
- start_date (date)
- end_date (date)
- duration_days (decimal, for half-days: 0.5)
- duration_type (enum: 'full', 'half')
- status (enum: 'pending', 'approved', 'rejected')
- reason (text)
- approved_by (uuid, foreign key to profiles, nullable)
- created_at, updated_at
```

