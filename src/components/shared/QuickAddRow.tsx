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
        className="w-full justify-start rounded-md border border-dashed border-border/70 text-muted-foreground transition-[border-color,background-color,color,transform] duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground motion-reduce:transform-none motion-reduce:transition-none"
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
