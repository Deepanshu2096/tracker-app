/**
 * Mock data for employee profile & change-request flow (no DB required).
 * Use from now until employee_management_schema migration is applied.
 */

import type { ProfileStatus } from '@/store/profileStore';

export type ChangeRequestStatus = 'pending_hr_approval' | 'approved' | 'rejected';

export interface MockChangeRequest {
  id: string;
  profile_id: string;
  requested_by_user_id: string;
  status: ChangeRequestStatus;
  requested_data: Record<string, unknown>;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string | null;
  employee_email?: string | null;
}

export const USE_MOCK_PROFILE_DATA = true;

/** All possibly-missing profile fields (phone, birthday, doj, city, avatar_url, profile_status, extended, etc.) */
const mockProfileOverlay = new Map<string, Record<string, unknown>>();

export function getMockProfileOverlay(userId: string): Record<string, unknown> | undefined {
  return mockProfileOverlay.get(userId);
}

export function setMockProfileOverlay(userId: string, data: Record<string, unknown>): void {
  const current = mockProfileOverlay.get(userId) ?? {};
  mockProfileOverlay.set(userId, { ...current, ...data });
}

export function getMockProfileStatus(userId: string): ProfileStatus | undefined {
  return getMockProfileOverlay(userId)?.profile_status as ProfileStatus | undefined;
}

export function setMockProfileStatus(userId: string, status: ProfileStatus): void {
  setMockProfileOverlay(userId, { profile_status: status });
}

export function getMockAvatarUrl(userId: string): string | null | undefined {
  const v = getMockProfileOverlay(userId)?.avatar_url;
  return v === undefined ? undefined : (v as string | null);
}

export function setMockAvatarUrl(userId: string, url: string | null): void {
  setMockProfileOverlay(userId, { avatar_url: url });
}

const mockChangeRequests: MockChangeRequest[] = [];

export function getMockChangeRequests(): MockChangeRequest[] {
  return [...mockChangeRequests];
}

export function addMockChangeRequest(request: Omit<MockChangeRequest, 'id' | 'created_at' | 'updated_at'>): MockChangeRequest {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: MockChangeRequest = {
    ...request,
    id,
    created_at: now,
    updated_at: now,
  };
  mockChangeRequests.push(row);
  return row;
}

export function updateMockChangeRequest(
  requestId: string,
  update: Partial<Pick<MockChangeRequest, 'status' | 'rejection_reason' | 'reviewed_at' | 'reviewed_by'>>
): void {
  const i = mockChangeRequests.findIndex((r) => r.id === requestId);
  if (i >= 0) {
    mockChangeRequests[i] = { ...mockChangeRequests[i], ...update, updated_at: new Date().toISOString() };
  }
}

export function getMockChangeRequest(requestId: string): MockChangeRequest | undefined {
  return mockChangeRequests.find((r) => r.id === requestId);
}

export function getMockPendingForHR(): MockChangeRequest[] {
  return mockChangeRequests
    .filter((r) => r.status === 'pending_hr_approval')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getMockMyRequests(profileId: string): MockChangeRequest[] {
  return mockChangeRequests
    .filter((r) => r.profile_id === profileId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
