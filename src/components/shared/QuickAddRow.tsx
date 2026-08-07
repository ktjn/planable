import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { fireAndForget } from '../../lib/fireAndForget';

export function QuickAddRow({
  onAdd,
  label = '+ Quick add',
  placeholder = 'Type a title…',
}: {
  onAdd: (title: string) => Promise<void>;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    fireAndForget(onAdd(trimmed));
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start rounded-md border border-dashed border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <Input
      autoFocus
      placeholder={placeholder}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          submit();
        } else if (e.key === 'Escape') {
          setOpen(false);
          setTitle('');
        }
      }}
      onBlur={() => {
        if (!title.trim()) setOpen(false);
      }}
    />
  );
}
