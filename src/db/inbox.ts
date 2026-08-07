import type { Project, Container } from './schema';

export const INBOX_PROJECT_ID = 'inbox';
export const INBOX_CONTAINER_ID = 'inbox-container';

export const INBOX_PROJECT: Project = {
  id: INBOX_PROJECT_ID,
  name: 'Inbox',
  order: -1,
};

export const INBOX_CONTAINER: Container = {
  id: INBOX_CONTAINER_ID,
  projectId: INBOX_PROJECT_ID,
  name: 'Inbox',
  order: 0,
  weekly: null,
};
