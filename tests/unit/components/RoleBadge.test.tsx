/**
 * Unit tests for RoleBadge component
 *
 * Tests:
 *  1. Renders "Admin" with crown icon for admin role
 *  2. Renders "Member" with person icon for member role
 *  3. Respects size prop (small, medium, large)
 *  4. Hides icon when showIcon=false
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RoleBadge } from '@/components/RoleBadge';

describe('RoleBadge', () => {
  // ── Admin role ─────────────────────────────────────────────────────
  it('renders "Admin" text for admin role', () => {
    const { getByText } = render(<RoleBadge role="admin" />);
    expect(getByText('Admin')).toBeTruthy();
  });

  it('shows crown icon for admin role', () => {
    const { getByText } = render(<RoleBadge role="admin" />);
    expect(getByText('👑')).toBeTruthy();
  });

  // ── Member role ───────────────────────────────────────────────────
  it('renders "Member" text for member role', () => {
    const { getByText } = render(<RoleBadge role="member" />);
    expect(getByText('Member')).toBeTruthy();
  });

  it('shows person icon for member role', () => {
    const { getByText } = render(<RoleBadge role="member" />);
    expect(getByText('👤')).toBeTruthy();
  });

  // ── Size variants ─────────────────────────────────────────────────
  it('renders at small size', () => {
    const { getByText } = render(<RoleBadge role="admin" size="small" />);
    expect(getByText('Admin')).toBeTruthy();
  });

  it('renders at medium size (default)', () => {
    const { getByText } = render(<RoleBadge role="admin" />);
    expect(getByText('Admin')).toBeTruthy();
  });

  it('renders at large size', () => {
    const { getByText } = render(<RoleBadge role="member" size="large" />);
    expect(getByText('Member')).toBeTruthy();
  });

  // ── showIcon ──────────────────────────────────────────────────────
  it('hides icon when showIcon is false', () => {
    const { queryByText, getByText } = render(
      <RoleBadge role="admin" showIcon={false} />,
    );
    expect(getByText('Admin')).toBeTruthy();
    expect(queryByText('👑')).toBeNull();
  });

  it('shows icon by default', () => {
    const { getByText } = render(<RoleBadge role="member" />);
    expect(getByText('👤')).toBeTruthy();
  });
});
