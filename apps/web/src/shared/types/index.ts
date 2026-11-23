export type User = { id: number; name: string; username: string };
export type Member = { id: number; name: string; family: string };
export type Wish = {
  id: number;
  userId: number;
  title: string;
  detail: string;
  link: string;
  favorite: boolean;
};
export type Group = {
  id: number;
  name: string;
  description: string;
  eventDate: string;
  budget: string;
  status: string;
  invite: string;
  owner: boolean;
  scheduledAt: string | null;
  members: Member[];
  targetId: number;
  targetName: string;
  wishes: Wish[];
  unread: { incoming: number; outgoing: number };
};

export type GroupSummary = {
  id: number;
  name: string;
  status: string;
  eventDate: string;
  scheduledAt: string | null;
  count: number;
  unread: number;
};

export type GroupSearchResult = {
  items: GroupSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
