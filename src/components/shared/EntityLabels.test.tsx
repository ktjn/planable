import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EntityLabels } from './EntityLabels';
import type { Label } from '../../db/schema';

const labels: Label[] = [
  { id: 'l1', name: 'Security', color: '#ff0000' },
  { id: 'l2', name: 'Backend', color: '#00ff00' },
];
const labelsById = new Map(labels.map((l) => [l.id, l]));

describe('EntityLabels', () => {
  it('renders names for the referenced label IDs', () => {
    render(<EntityLabels labelIds={['l1', 'l2']} labelsById={labelsById} />);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('ignores unknown or deleted label IDs safely', () => {
    render(<EntityLabels labelIds={['l1', 'missing']} labelsById={labelsById} />);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.queryByText('missing')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no labels', () => {
    const { container } = render(<EntityLabels labelIds={[]} labelsById={new Map()} />);
    expect(container.firstChild).toBeNull();
  });
});
