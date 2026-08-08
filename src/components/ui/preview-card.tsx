import * as React from 'react';
import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import { cn } from '@/lib/utils';

function PreviewCardRoot({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />;
}

function PreviewCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />;
}

function PreviewCardPortal({ ...props }: PreviewCardPrimitive.Portal.Props) {
  return <PreviewCardPrimitive.Portal data-slot="preview-card-portal" {...props} />;
}

function PreviewCardPositioner({
  className,
  ...props
}: PreviewCardPrimitive.Positioner.Props) {
  return (
    <PreviewCardPrimitive.Positioner
      data-slot="preview-card-positioner"
      className={cn('z-50', className)}
      {...props}
    />
  );
}

function PreviewCardPopup({ className, ...props }: PreviewCardPrimitive.Popup.Props) {
  return (
    <PreviewCardPrimitive.Popup
      data-slot="preview-card-popup"
      className={cn(
        'max-w-xs rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
        className,
      )}
      {...props}
    />
  );
}

function PreviewCardArrow({ className, ...props }: PreviewCardPrimitive.Arrow.Props) {
  return (
    <PreviewCardPrimitive.Arrow
      data-slot="preview-card-arrow"
      className={cn('bg-popover', className)}
      {...props}
    />
  );
}

export const PreviewCard = {
  Root: PreviewCardRoot,
  Trigger: PreviewCardTrigger,
  Portal: PreviewCardPortal,
  Positioner: PreviewCardPositioner,
  Popup: PreviewCardPopup,
  Arrow: PreviewCardArrow,
};
