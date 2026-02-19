export type Verbosity = "quiet" | "normal" | "verbose";

export interface InboundMessage {
  id: string;
  channel: ChannelType;
  channelMessageId?: string;
  userId: string;
  userName?: string;
  projectId: string;
  botId?: string;
  instruction: string;
  verbosity?: Verbosity;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type ChannelType =
  | "rest"
  | "ssh"
  | "web"
  | "telegram"
  | "slack"
  | "discord"
  | "github"
  | "email"
  | "kanban"
  | "bot";

export interface Attachment {
  filename: string;
  contentType: string;
  content: Buffer | string;
}
