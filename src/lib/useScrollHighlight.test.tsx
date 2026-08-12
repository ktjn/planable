import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useScrollHighlight, type HighlightRequest } from './useScrollHighlight';

function Probe({ request, targetId }: { request: HighlightRequest | null; targetId: string }) {
  const highlighted = useScrollHighlight(request);
  return (
    <div>
      <div id={targetId}>target</div>
      <span data-testid="highlighted">{highlighted ?? 'none'}</span>
    </div>
  );
}

describe('useScrollHighlight', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets the highlighted id once the target element exists and scrolls it into view', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<Probe request={{ id: 'thing-1', key: 1 }} targetId="thing-1" />);

    await waitFor(() => expect(screen.getByTestId('highlighted')).toHaveTextContent('thing-1'));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('clears the highlight automatically after a short delay', async () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();

    render(<Probe request={{ id: 'thing-2', key: 1 }} targetId="thing-2" />);

    await vi.waitFor(() => expect(screen.getByTestId('highlighted')).toHaveTextContent('thing-2'));
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(screen.getByTestId('highlighted')).toHaveTextContent('none'));
  });

  it('stays cleared when request is null', () => {
    render(<Probe request={null} targetId="thing-3" />);
    expect(screen.getByTestId('highlighted')).toHaveTextContent('none');
  });
});
