import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// jsdom doesn't implement scrollIntoView; useScrollHighlight relies on it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// localStorage persists across tests within a jsdom environment otherwise, letting
// state like console history leak between unrelated test files.
afterEach(() => {
  localStorage.clear();
});
