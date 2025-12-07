import { Timestamp } from "firebase/firestore";

export type Playbook = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  notes?: string;
  tags?: string[]; // e.g. ["trend", "breakout", "news"]
  timeframes?: string[]; // e.g. ["M5", "H1"]
  instruments?: string[]; // e.g. ["XAUUSD", "BTCUSD"]
  isArchived?: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
};

export type CreatePlaybookInput = Omit<Playbook, "id" | "userId" | "createdAt" | "updatedAt">;

export type UpdatePlaybookInput = Partial<CreatePlaybookInput>;

