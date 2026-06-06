export type ThreadRow = {
  id: string;
  subject_type: 'listing' | 'wanted';
  listing_id: string | null;
  wanted_request_id: string | null;
  approach_id: string | null;
  buyer_org_id: string;
  seller_org_id: string;
  kind: 'qa' | 'mediation';
  contact_disclosed: boolean;
  status: 'open' | 'closed';
  created_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_type: 'buyer' | 'seller' | 'operator';
  sender_user_id: string | null;
  body: string;
  visible_to: 'all' | 'buyer_side' | 'seller_side';
  created_at: string;
};

export const SENDER_LABELS: Record<string, string> = {
  buyer: '買い手',
  seller: '売り手',
  operator: '運営',
};

export function resolveSenderType(
  orgId: string,
  thread: Pick<ThreadRow, 'buyer_org_id' | 'seller_org_id'>,
  isAdmin: boolean
): 'buyer' | 'seller' | 'operator' | null {
  if (isAdmin) return 'operator';
  if (orgId === thread.buyer_org_id) return 'buyer';
  if (orgId === thread.seller_org_id) return 'seller';
  return null;
}
