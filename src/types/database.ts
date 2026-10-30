export type UserRole = 'admin' | 'member';
export type PresenceStatus = 'confirmed' | 'pending_partner' | 'cancelled';
export type AlertType = 'solo_window' | 'cancellation_risk' | 'checkout_risk' | 'emergency';
export type RideDirection = 'to_venue' | 'from_venue';
export type RideRequestStatus = 'unassigned' | 'assigned' | 'failed' | 'cancelled';
export type RideAssignmentStatus = 'pending_driver_acceptance' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'CHECK_IN' | 'CHECK_OUT' | 'CANCEL' | 'OVERRIDE';
export type NotificationChannel = 'telegram' | 'email' | 'in_app';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  has_car: boolean;
  available_seats: number;
  password?: string | null;
  pickup_zone: string | null;
  default_pickup_point: string | null;
  telegram_chat_id: number | null;
  telegram_verification_code: string | null;
  telegram_verified_at: string | null;
  notify_by_telegram: boolean;
  notify_by_email: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  min_presence_required: number;
  admin_counts_for_coverage: boolean;
  slot_interval_minutes: number;
  overlap_tolerance_minutes: number;
  operating_hours_start: string;
  operating_hours_end: string;
  timezone: string;
  weekly_report_day: number;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  day_of_week: number | null; // 0=Dom, 1=Lun, ..., 6=Sáb
  specific_date: string | null; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  is_recurring: boolean;
  created_at: string;
}

export interface PresenceWindow {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  note: string | null;
  status: PresenceStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  need_ride_to: boolean;
  need_ride_from: boolean;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface CoverageSlot {
  slot_start: string;
  slot_end: string;
  person_count: number;
  user_ids: string[];
  user_names: string[];
  status: 'empty' | 'solo' | 'covered';
}

export interface RideRequest {
  id: string;
  user_id: string;
  presence_window_id: string;
  direction: RideDirection;
  target_time: string;
  pickup_zone: string | null;
  pickup_address: string | null;
  status: RideRequestStatus;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface RideAssignment {
  id: string;
  request_id: string;
  driver_id: string;
  driver_window_id: string | null;
  scheduled_pickup_time: string;
  pickup_location: string;
  status: RideAssignmentStatus;
  rejection_reason: string | null;
  driver_response_at: string | null;
  created_at: string;
  updated_at: string;
  driver?: Profile;
  ride_requests?: RideRequest;
}

export interface AuditLogEntry {
  id: string;
  performed_by: string | null;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
  performer?: Profile;
}
