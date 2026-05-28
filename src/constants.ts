import { UserRole } from './store/useStore';

export const VISIBILITY_OPTIONS = [
  { value: 'vip++', label: 'VIP++' },
  { value: 'vip+', label: 'VIP+' },
  { value: 'vip', label: 'VIP' },
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
] as const;

export type VisibilityType = (typeof VISIBILITY_OPTIONS)[number]['value'];

export function getAllowedVisibility(role: UserRole) {
  if (role === 'admin') return VISIBILITY_OPTIONS;
  
  const roleIndex = VISIBILITY_OPTIONS.findIndex(opt => opt.value === role);
  if (roleIndex === -1) {
    // Standard user can only pick Public and below
    return VISIBILITY_OPTIONS.filter(opt => ['public', 'unlisted', 'private'].includes(opt.value));
  }
  
  // VIP users can pick their level and everything below
  return VISIBILITY_OPTIONS.slice(roleIndex);
}
